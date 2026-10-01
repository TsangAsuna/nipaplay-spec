# 内核内存架构溯源 — mpv / mdk-sdk（源码级，2026-10-02）

> 本文是三份并行深潜研究的合成，全部结论附 file:line 证据。
> 来源仓库：`third_party/mpv`（完整 mpv 0.41.0 源码树）、
> `packages/fvp-0.37.3/ohos/src/main/cpp/mdk-sdk`（mdk 头文件 + Changelog）、
> fvp 插件三平台源码、media_kit vendored 源码、NipaPlay adapter 层。
> 用途：**先理解，再创新** —— 任何内核内存优化必须引用本文的机制事实。

## 1. mpv (libmpv) 播放内存地图（1080p 基准）

字节基准：1080p NV12 帧 ≈ 3.1 MB；rgba16f FBO ≈ 16.6 MB；rgba8 ≈ 8.3 MB。

### 宿主 RAM
| 区域 | 默认 | 边界选项（file:line 相对 third_party/mpv） |
|---|---|---|
| 解复用前向缓存 | 流媒体 ~按 readahead 1s；上限 150 MiB | `demuxer-max-bytes=150MiB`（demux/demux.c:138）、`demuxer-readahead-secs=1.0`（:141）|
| 解复用后向缓存 | 本地 0；流媒体至 50 MiB | `demuxer-max-back-bytes=50MiB`（:139；非 seekable-cache 为 0 :2483）|
| copy-back 帧池 | 峰值 7-8 帧 ≈ 25 MB，**永不收缩** | 隐式：delay_queue 2（vd_lavc.c:68,787）+ lookahead 2 + vo 2 + render 1；池保留 freed images（mp_image_pool.c:186-190）|
| SW 解码 FFmpeg 池 | threads(auto)×3.1MB + 重排 ≈ 25-60 MB | `vd-lavc-threads`（vd_lavc.c:111）|
| DR 映射上传缓冲（仅 ADVANCED_CONTROL+dr）| ≈7-8×3.1MB，uninit 才释放 | gpu/video.c:4349-4360, 4135 |
| 播放器/VO/render 帧引用 | 仅引用（无像素拷贝）；render ctx 最多 2 帧 | vo_libmpv.c:88-93；VO_MAX_REQ_FRAMES=10（vo.h:215）|
| 解码器输出队列 | 默认关 | `vd-queue-enable`（f_decoder_wrapper.c:1244）|
| 音频 | ~0.4s ≈ 150 KB | audio-buffer=0.2（ao.c:158）|
| libass 缓存 | mpv 传 0 → libass 默认（不受 mpv 约束） | `ass_set_cache_limits(0,0)`（sub/sd_ass.c:291）|
| cache-on-disk | 普通文件 IO，**非 mmap，不占 RAM** | demux/cache.c:160,183 |

### VRAM
| 区域 | 默认 | 说明 |
|---|---|---|
| 硬解表面池 | (ffmpeg 初始 + hwdec-extra-frames-1) × 3.1MB ≈ 28MB | `hwdec-extra-frames=6`（vd_lavc.c:174,965）|
| **FBO 表面环** | rgba16f 16.6MB × 最多 10 ≈ **166MB**（仅插值开启时）| `SURFACES_MAX=10`（gpu/video.c:125）；`fbo-format=auto→rgba16f`（:3916-3935，**与输入位深无关**）|
| 输出/混合/合并纹理组合 | 16.6-33MB | gpu/video.c:674-683 |

### 关键机制事实
- **`auto-copy` 复制链**：VT 解码 → delay_queue(2) → `mp_image_hw_download` 到 swpool（**按解码器全尺寸分配**，mp_image_pool.c:302）→ GPU→RAM 拷贝 → gl_video 再上传纹理。直接 VT 则 IOSurface 逐帧绑定为 GL 纹理（hwdec_mac_gl.c:114-119），RAM 零像素。
- **render API 背压**：update 与 render 之间 mpv **不再排队**（vo_libmpv.c:494 断言）；Flutter 渲染线程卡顿表现为 `flip_page` 等待 200ms 后丢帧（:508-551），**绝不增长内存**。
- **无界嫌疑清单**：hwdec_swpool 高水位、dr_buffers、FBO 环保持最大分配、OSD 图集不收缩、libass 缓存无 mpv 侧上限（`sub-glyph-limit`/`sub-bitmap-max-size` 可设）、包结构池。

### mpv 旋钮表（内存相关，含质量代价）
| 选项 | 默认 | 降它的代价 |
|---|---|---|
| `fbo-format` | auto→rgba16f | rgba8 省一半 FBO 内存；**10bit 渐变可能色带**（剧场版常见 10bit HEVC，慎用）|
| `hwdec-extra-frames` | 6 | 2 时 VRAM 省 ~12MB；解码池饥饿会卡顿 |
| `video-latency-hacks` | off | on 省一帧 lookahead；延迟容忍型播放器无感 |
| `sub-glyph-limit` / `sub-bitmap-max-size` | 0→libass 默认 | 设上限可封顶复杂 ASS 的内存；重排版字幕重光栅化 |
| `demuxer-max-bytes/back-bytes` | 150/50 MiB | media_kit 已按 bufferSize 覆盖（32MB/我们已改 back 8MB）|
| `interpolation` | off | on 时 +3-10 张 rgba16f；默认已关 |

## 2. mdk-sdk 播放内存地图

### 机制事实（Changelog/头文件引用）
- **setBufferRange = 压缩包级、宿主 RAM、按轨**：min=起解阈值（默认 1000ms），max=解复用背压（默认 4000ms，"Large value is recommended. Latency is not affected"，Player.h:762）；drop=true 丢旧非关键帧包。**NipaPlay 的 4-120s 预载 = 压缩包驻留 RAM**（8Mbps×30s ≈ 30MB），与帧数无关；latency 恒 ~minMs。
- **解码零拷贝是 mdk 默认**：`MFT:d3d=11` shader_resource=1（0.25.0, CHG:490）→ GPU 常驻 NV12 直接被渲染器采样；VT→CVPixelBuffer/IOSurface 直进 Metal；AMediaCodec image=1 默认；OH 0-copy（0.36.0）。对比：media_kit/mpv 路径默认 copy-back —— **这就是 MDK 600MB vs libmpv 1GB 的架构差**。
- **渲染目标两种模式**：`updateNativeSurface()`（mdk 自持 swapchain，buffers=2 —— OHOS 路径用）或 `setRenderAPI()` 外部纹理（`rtv`/`texture`）。fvp 用外部纹理：Windows = mdk 直画进 `rt` + 每帧一次 `CopyResource` 到 shared 纹理（fvp_plugin.cpp:63）；iOS = 单 MTLTexture + 单 CVPixelBuffer + 每帧 blit（FvpPlugin.mm:72-82，TODO "texture pool to avoid blitting" :97）。
- **帧队列旋钮**：全局 `videoout.buffer_frames`（global.h:228）—— 渲染器最大缓存帧数，作者内部调优值（小）。
- **解复用时间范围缓存默认关**：`demux.buffer.ranges=0`（Player.h:448）。
- **字幕**：libass 内置，`subtitle.size=video`（按视频帧分辨率渲染 RGBA），区域拆分省带宽（`subtitle.ass.regions.max`，0.31.0）。
- 音频无显式缓冲旋钮；PCM 宿主 RAM（AudioFrame.h:168-180）。

### 1080p 内存表（NipaPlay 默认）
| 区域 | 存储 | 估算 |
|---|---|---|
| 包队列 | RAM | 4s 预载 ≈ 4MB@8Mbps（用户可到 30MB）|
| MFT 解码表面池 | VRAM | 8-20 × 3.1MB ≈ 25-60MB |
| 渲染队列 | 引用（0-copy）| ≈0 额外 |
| rt + shared 纹理 | VRAM | 8.3 + 8.3 MB（Windows）|
| iOS MTLTexture + CVPixelBuffer | VRAM | 8.3 + 8.3 MB |

### mdk vs mpv 架构差异（决定性结论）
1. **包队列**：mpv 大缓存字节/时长双上限；mdk 单时长门（min/max）+ 可选范围缓存（默认关）。
2. **拷贝 vs 直通默认**：mdk 匹配即 0-copy（默认）；mpv 默认 hwdec=no 且 NipaPlay 此前配 copy-back —— 已修（iOS videotoolbox,auto）。
3. **渲染目标所有权**：mdk 可自持 swapchain（OHOS 已用）或外部纹理（fvp 强加的 CopyResource/blit 是**插件选择**，非内核必然）；mpv render API 恒为"渲染进客户端 FBO"，无内部 blit。
4. **线程**：mdk 外部纹理模式下渲染发生在嵌入者线程（renderVideo 回调）；mpv demux/decode/vo/audio 四线程 + 音频时钟同步。

## 3. 对 NipaPlay 的直接推论（已实施 / 待实施）

**已实施**（本轮）：
- iOS libmpv → `videotoolbox,auto` 直通 + `hwdec-extra-frames=2`（消除 copy-back 池 ~25MB + 上传/下载带宽）。
- `demuxer-max-back-bytes=8MB`（media_kit 默认 32MB×2 的对半）。
- iOS 默认内核 → Erika（CAMetalLayer 直渲 + 内核弹幕，绕开整条 Flutter 纹理管线）。
- MediaKit.ensureInitialized 按内核门控（iOS Erika 用户不再急切 dlopen Mpv.framework）。
- 启动路径清理：历史 3 次加载去重并延后、WebServer 绑定延后、插件 JS 扫描延后、dandanplay 网络延后、rust 探针不阻塞。

**待实施（按证据优先级，动前再核）**：
1. **`sub-glyph-limit`/`sub-bitmap-max-size`** 给 libass 缓存封顶（mpv 路径复杂 ASS 剧场版的唯一无界项）。
2. **Windows fvp CopyResource 消除**：mdk 支持 `D3D11RenderAPI` 外部纹理直画 —— 若把 Flutter 纹理注册从"shared-handle 拷贝"改为 ANGLE 侧 keyed-mutex 共享（或 texture 2D array rtv 模式 0.33.0，RH:128-131），每帧省一次全屏 GPU 拷贝。属 fvp 插件改造，风险中。
3. **fbo-format 用户可选档**（省 50-80MB VRAM，换 10bit 渐变质量）—— 做成设置项而非默认。
4. **Erika OHOS 桥**（next2_texture_bridge 的 OHNativeWindow 移植）—— 鸿蒙 UI 性能的正解。
5. **`videoout.buffer_frames`** 若实测 mdk 渲染队列超预期再调（作者已调优，先不动）。

## 4. 指标与验证约定
- 内存口径：rust `performance.rs` RSS 采样（iOS 可用）或 Xcode gauge；**同一指标前后对比**。
- libmpv 生效模式：首帧后日志 `hwdec-current`。
- 每次 A/B 只动一个变量（内核或选项），同片源同字幕配置。
