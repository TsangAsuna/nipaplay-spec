# NipaPlay-Reload — Feature Spec

Feature listing of the NipaPlay-Reload repository as of commit `b098594d` (verified HEAD of branch `nipaplay` via `git rev-parse HEAD` → `b098594d57e0d16b3768ee0c85e5aa8b477a39d3`), derived from that tree: `README.md`, `CONTRIBUTING_GUIDE/`, `Documentation/`, `docs/`, `lib/`, `rust/`, platform projects, and recent commit subjects. Every feature names its implementing path.

## Overview

*Verified against the tree at `b098594d`.*

- Positioning: a modern cross-platform video player framed as a personal anime media center, with headline highlights of whole-platform parity, automatic dandanplay danmaku, Emby/Jellyfin/SMB/WebDAV library integration, Bangumi tracking, and a modern light/dark UI — `README.md:25-44`.
- Platform support: Windows, macOS, Linux, Android and iOS are shipped download targets; tvOS and HarmonyOS are available as builds, with per-platform kernel/HDR caveats in the capability matrix — `README.md:28,92`, `Documentation/platform-matrix.md:5-14`.
- Platform host trees in-repo: `android/`, `ios/`, `linux/`, `macos/`, `windows/`, `web/`, `tvos/`, `ohos/` (HarmonyOS) plus `harmonyos_test/`; tvOS build guide with its dedicated Flutter fork — `docs/TVOS_DEVELOPMENT.md`.
- Distribution channels: GitHub Releases, App Store, Microsoft Store, Spark Store, Homebrew cask, AUR binary/source packages, Gentoo ebuild — `README.md:90-145`.
- Tech stack: Flutter/Dart app `nipaplay` 1.11.9 (Dart SDK ^3.5.3) — `pubspec.yaml:1,19-22`; pluggable playback engines Erika (self-developed Rust kernel, `erika_flutter` 0.2.0), FVP (MDK), Media Kit (libmpv backend) and Video Player behind `lib/player_abstraction/` — `pubspec.yaml:83,123,129-135`, `Documentation/player-kernels.md:3-12`, `README.md:187-200`.
- Rust+Dart hybrid architecture: native Rust crate under `rust/` bridged via flutter_rust_bridge 2.12.0 through the `rust_builder` plugin — `pubspec.yaml:165-167`, `flutter_rust_bridge.yaml`, `rust/Cargo.toml`, `README.md:177-178`.
- Supporting stack: Provider state management, SQLite (`sqflite`/`sqflite_common_ffi`) + SharedPreferences storage, Dio/Http networking, JS plugin runtime (`flutter_js`), in-repo forked components wired through dependency overrides — `pubspec.yaml:50,58,84-85,116-122,170,302-335`.
- Shipped roadmap — Bangumi comment sections: `lib/themes/nipaplay/widgets/bangumi_comments_widget.dart`, `lib/themes/nipaplay/widgets/bangumi_comment_dialog.dart`, `lib/models/bangumi_comment_model.dart`, embedded in `lib/pages/anime_detail_page.dart:26,51`.
- Shipped roadmap — GIF clip export: `lib/player_abstraction/erika_gif_export.dart` (+ `_io`/`_stub`), surfaced via `GifExportRequest` in `lib/themes/nipaplay/widgets/media_capture_dialog.dart:293`.
- Shipped roadmap — built-in downloader and remote control: `lib/services/torrent_download_service.dart` with the `lib/downloads/` UI, and the remote-control API `lib/services/remote_control_api_service.dart`.
- Shipped roadmap — online URL playback: paste-and-play http/https direct links in the unified playback entry — `lib/playback/unified_playback_entry_model.dart:43-49`, `lib/playback/adaptive_playback_entry_view.dart`.
- Shipped roadmap — macOS HDR (Erika native EDR + Media Kit): experimental native-video output toggle (`lib/settings/pages/player_settings_content.dart:106-116` → `lib/player_abstraction/player_factory.dart:313`), Media Kit platform-HDR validation path, and screen-EDR probe overlay — `lib/player_abstraction/media_kit_player_adapter.dart:69-129`, `lib/themes/nipaplay/widgets/macos_hdr_probe_overlay.dart:135-141`.
- Shipped roadmap — Apple TV (tvOS) developer preview: `tvos/` host project with the dedicated tvOS Flutter SDK guide — `docs/TVOS_DEVELOPMENT.md`.

## Player kernels

*Verified against the tree at `b098594d`.*

- Unified player abstraction: `AbstractPlayer` lifecycle contract (volume/rate/state/texture, media open, prepare/seek/dispose, audio & subtitle track selection, snapshot, decoder lists, properties, User-Agent, chapter jump, frame stepping) — `lib/player_abstraction/abstract_player.dart:93-167`.
- Optional capability interfaces probed per kernel — `AsyncDisposablePlayer`, `AsyncSeekPlayer`, `AsyncExternalSubtitlePlayer`, `MediaLoadAwarePlayer` (readiness probe + bounded `retryCurrentMediaLoad`), `GifExportCapablePlayer` with `GifExportRequest`/`GifExportResult`/`GifExportQuality`; remote opens budget 5 attempts (`networkMediaLoadMaxAttempts`) — `lib/player_abstraction/abstract_player.dart:6-42,44-91`.
- Client-facing `Player` facade: `Player()` builds the configured kernel via `PlayerFactory().createPlayer()`; exposes MDK-compatible `PlaybackState`/`MediaType` enums, capability probing, kernel-name reporting, detailed media info, upscaler control and native-danmaku passthrough — `lib/player_abstraction/player_abstraction.dart:37-56,448-460,477-527,529-602`.
- Kernel factory: `PlayerKernelType { mdk, videoPlayer, mediaKit, erika }`; `createPlayer` instantiates `MdkPlayerAdapter(httpProxy)`, `VideoPlayerAdapter`, `MediaKitPlayerAdapter(bufferSize, androidAudioOutput, httpProxy)` or `ErikaPlayerAdapter(androidOutputMode)`, forces Video Player on Web and falls back to the default kernel when unsupported — `lib/player_abstraction/player_factory.dart:17-23,420-458`.
- Kernel gating: Erika supported on macOS/iOS/Windows/Android/HarmonyOS and TV builds but not Linux (`isErikaKernelSupported`); per-kernel HTTP proxy only on MDK/Media Kit (`supportsPlayerHttpProxy`) — `lib/player_abstraction/player_factory.dart:65-76,25-27`; kernel guidance table `Documentation/player-kernels.md:9-12`, platform defaults `Documentation/platform-matrix.md:10,13`.
- tvOS forcing: init hard-sets Erika and persists it, `getKernelType` and the default kernel always return Erika on tvOS, only Erika passes platform validation, and `saveKernelType` rejects any other kernel — `lib/player_abstraction/player_factory.dart:99-104,230-237,239-247,461-469`.
- Kernel persistence: selection stored under SharedPreferences key `player_kernel_type`, loaded by `initialize()` with invalid/unsupported entries falling back to the default; `saveKernelType` re-saves and updates the resource-monitor kernel label — `lib/player_abstraction/player_factory.dart:30,88-117,461-504`.
- Kernel-change broadcast: `onKernelChanged` stream fires on kernel save and on rebuild-requiring setting changes (macOS native-video toggle under Media Kit, Erika Android output mode, HTTP proxy) — `lib/player_abstraction/player_factory.dart:60-63,313-327,354-371,406-417,500`.
- Playback settings loaded/saved alongside the kernel: Media Kit precache buffer 4–512 MB (default 32), Android audio output `opensles`/`audiotrack`, macOS native-video preference, Erika Android output mode SDR/extended-linear HDR — `lib/player_abstraction/player_factory.dart:31-38,123-138,284-311,329-345,347-382`.
- Custom persistent plus one-shot (next-open-only, auto-consumed) playback User-Agent handed to the kernel before media open — `lib/player_abstraction/player_factory.dart:45,47,249-276,386-399`.
- Erika adapter: `ErikaPlayerAdapter` wraps the self-developed Rust kernel through `erika_flutter` 0.2.0 (`ErikaPlayer`), implementing `AbstractPlayer` plus `AsyncDisposablePlayer`/`AsyncSeekPlayer`/`AsyncExternalSubtitlePlayer`/`GifExportCapablePlayer` — `lib/player_abstraction/erika_player_adapter.dart:574-595`, `pubspec.yaml:135`.
- Erika media path: `prepare()` opens with a per-source `User-Agent` header; async seek with a 1.5 s seek fence; generation-guarded external-subtitle replacement that removes old native tracks; asynchronous dispose — `lib/player_abstraction/erika_player_adapter.dart:902-937,948-978,1116-1154`.
- Erika rendering: prefers the native platform video surface on every supported platform, window-overlay surface on desktop (non-Android/non-OHOS) via `_NipaplayErikaWindowOverlayVideoView`; Android output mode maps to native `ErikaOutputMode` SDR/extended-linear — `lib/player_abstraction/erika_player_adapter.dart:725-730,1260,223-246,652-663`.
- Erika native danmaku: composites danmaku into the video frame (`supportsNativeDanmaku`) with load/clear/enable/global-offset/config forwarded through coalesced 50 ms patches (font, opacity, display area, stacking, block words, per-mode line caps) — `lib/player_abstraction/erika_player_adapter.dart:16-64,1289-1460`.
- MDK adapter: `MdkPlayerAdapter` on the `fvp` MDK wrapper (`fvp: ^0.33.1`, HarmonyOS swaps in the 0.37.3 fork via `pubspec_overrides.ohos.yaml`), accepting both FVP 0.33 callback and 0.37 stream `onEvent` forms — `lib/player_abstraction/mdk_player_adapter_io.dart:202-235`, `pubspec.yaml:80-85`, `pubspec_overrides.ohos.yaml:77-78`.
- MDK behavior: sticky properties (HTTP proxy, `auto_load=0`, subtitle) reapplied on player rebuild; proxy via `avformat.http_proxy`/`avio.http_proxy`; User-Agent properties; decoder selection with active-decoder events; ~42 ms seek frame-stepping; snapshot; mobile subtitle font provisioning from `assets/subfont.ttf` — `lib/player_abstraction/mdk_player_adapter_io.dart:20-26,237-265,547-551,507-534,562,574,486,267-315`; non-IO builds get a no-op stub through conditional export — `lib/player_abstraction/mdk_player_adapter.dart:1-2`, `lib/player_abstraction/mdk_player_adapter_unsupported.dart:6`.
- Media Kit adapter: `MediaKitPlayerAdapter` over the in-repo media_kit fork (libmpv backend, `packages/media_kit`, libs under `third_party/media-kit-upstream`), libass subtitles with the bundled Android font, byte-based `bufferSize`, mpv property options — `lib/player_abstraction/media_kit_player_adapter.dart:347-405`, `pubspec.yaml:129-134,312-329`.
- Media Kit load readiness: implements `MediaLoadAwarePlayer` — `isMediaReady`/`hasReceivedRealPosition`/`hasMediaLoadFailed`/`mediaLoadError`, `waitUntilMediaReady`, and up-to-5 retries of network opens gated by retryable-error classification — `lib/player_abstraction/media_kit_player_adapter.dart:37-58,2110-2174`.
- Media Kit native surface & HDR: platform native video surface on macOS/Windows (mpv `vo=libmpv`, window-overlay surface on macOS), HDR output options (`gpu-api`/`gpu-context`/`target-colorspace-hint`/`hdr-compute-peak`, D3D11 chain on Windows) with env-flag overrides and diagnostics, Android `ao` audio-output selection, quiet mpv logs unless diagnostics enabled — `lib/player_abstraction/media_kit_player_adapter.dart:228-254,518-528,3002-3009,463-516,420-428,81-91,117-124`.
- Media Kit features: MKV chapter jump via the mpv `chapter` property with graceful degradation, frame stepping, snapshot, `user-agent` property, external subtitles supported — `lib/player_abstraction/media_kit_player_adapter.dart:2872-2895,2975,2988,2620,2682,2194-2195`.
- Video Player adapter: `VideoPlayerAdapter` on the official `video_player` 2.9.5 (plus the tvOS federated fork `video_player_tvos`), forced on Web; delayed controller rebuild, 15 s init timeout with one recovery retry, friendly corrupted-file media info; external subtitles/decoders/chapter/User-Agent unsupported (stubs) — `lib/player_abstraction/video_player_adapter.dart:20,305,438-536,802-836`; snapshot falls back to a black frame or watch-history cover art — `:557-600`.
- Unified GIF clip export: `Player.supportsGifExport`/`exportGif` prefer a capable delegate but fall back to headless Erika export whenever the platform supports it — `lib/player_abstraction/player_abstraction.dart:273-294`.
- Erika GIF export pipeline: `exportGifHeadless` validates start<end, 1–60 fps and 1–8192 px, normal/high quality, then runs the native `erika_export_gif` C API on a background isolate via FFI with optional HTTP headers; library resolved per platform (macOS Frameworks + `ERIKA_CAPI_DYLIB`, Windows `erika_capi.dll`, Android/OHOS `liberika_capi.so`, iOS in-process), non-IO builds stub out — `lib/player_abstraction/erika_player_adapter.dart:676-723`, `lib/player_abstraction/erika_gif_export.dart:1-7`, `lib/player_abstraction/erika_gif_export_io.dart:79-163,165-196`, `lib/player_abstraction/erika_gif_export_stub.dart:1-5`.
- GIF export UI: capture dialog gates the entry on `supportsGifExport` and issues `GifExportRequest` (input/output paths, start/end, fps, dimensions, quality) — `lib/themes/nipaplay/widgets/media_capture_dialog.dart:256,292-303`.

## Decoder / Hardware-Decompress Options

- Full mpv `--hwdec` mode enum (no/auto/auto-safe/auto-copy, d3d12va, d3d11va, dxva2, videotoolbox, vaapi, nvdec, drm, vulkan, vdpau, mediacodec, cuda, crystalhd, rkmpp, amf, qsv, plus `-copy` non-passthrough variants), mapped per kernel — `lib/player_abstraction/hwdec_type.dart:4-38`.
- Global hardware-decode master switch bridged into player construction (`lib/player_abstraction/player_factory.dart:55-57`).
- Per-platform MDK decoder lists (VideoToolbox on macOS/iOS; MFT/D3D11/D3D12/DXVA/CUDA/QSV/NVDEC on Windows; VAAPI/VDPAU/CUDA/NVDEC/rkmpp/V4L2M2M on Linux with NVIDIA reordering; MediaCodec on Android; OH on HarmonyOS) — `lib/utils/decoder_manager.dart:11-54`.
- Erika Android output mode SDR vs extended-linear HDR (`PlayerErikaAndroidOutputMode`) — `lib/player_abstraction/player_data_models.dart:3-6`, applied at `lib/player_abstraction/erika_player_adapter.dart:660`.

## Image Quality & Rendering

- Anime4K super-resolution shader presets (off/lite/standard/high) staged from `assets/shaders/anime4k` — `lib/utils/anime4k_shader_manager.dart`; `README.md:153`.
- CRT shader effect presets (off/lite/standard/high) — `lib/utils/crt_shader_manager.dart`.
- Upscaler mode selection (`PlayerUpscalerMode`) — `lib/player_abstraction/player_data_models.dart:8`; ArtCNN and HDR/EDR paths documented per platform — `Documentation/player-kernels.md:9`, `Documentation/platform-matrix.md:9-14`.

## Danmaku Engines

- Switchable danmaku engines via `DanmakuRenderEngine`: CPU, GPU, Canvas, NipaPlay Next, Next2 (logic + Rust rendering), DFM+ — `lib/danmaku_abstraction/danmaku_kernel_factory.dart:11-29`, with persisted selection and switch broadcast (`:84-205`).
- GPU renderer suite: scroll/top/bottom renderers, dynamic font atlas, config, overlay — `lib/danmaku_gpu/lib/gpu_scroll_danmaku_renderer.dart`, `gpu_top_danmaku_renderer.dart`, `gpu_bottom_danmaku_renderer.dart`, `dynamic_font_atlas.dart`, `gpu_danmaku_overlay.dart`.
- NipaPlay Next/Next2 engines: MSDF text rendering, sprite atlases, native vsync, texture bridge, overlay viewport — `lib/danmaku_next/nipaplay_next_engine.dart`, `msdf_text_renderer.dart`, `danmaku_sprite_atlas.dart`, `next2_native_vsync.dart`, `next2_texture_bridge.dart`, `next2_overlay_viewport.dart`; Rust engine `rust/src/next2_engine.rs`, `rust/src/next2_android_jni.rs`, `rust/src/api/next2.rs`; design notes `docs/GPU_DANMAKU_ENGINE_DESIGN.md`.
- DFM+ engine: Bilibili DanmakuFlameMaster algorithm + Rust + GPU rendering — `lib/danmaku_dfm/dfm_plus_overlay.dart`, `lib/danmaku_dfm/dfm_plus_layout_bridge.dart`, `rust/src/dfm_core/`, `rust/src/api/dfm_plus.rs`.
- "NipaPlay Next++" aggressive-optimization toggle for the Next engine — `lib/danmaku_abstraction/danmaku_kernel_factory.dart:39-76`.
- Default engine DFM+ where supported; falls back to NipaPlay Next on Web and on Linux NVIDIA graphics stacks; unsupported Next2/DFM+ selections sanitize to Next — `lib/danmaku_abstraction/danmaku_kernel_factory.dart:42-46,194-201`.
- Plugin-provided danmaku renderers selectable as engines — `lib/danmaku_abstraction/danmaku_kernel_factory.dart:123-168`, `lib/plugins/models/plugin_danmaku_renderer.dart`, `lib/plugins/danmaku/`.

## Danmaku Services

- Automatic danmaku matching/download via the dandanplay API, with manual re-matching — `lib/services/dandanplay_service.dart` (+ `_io`/`_stub` splits), `lib/services/danmaku_matching_service.dart`, `lib/services/manual_danmaku_matcher.dart`; `README.md:161`.
- Local danmaku mounting of xml/json files — `lib/utils/local_danmaku_file.dart`; danmaku fetch/filter by episode with current-style and ASS-string export — `lib/services/danmaku/danmaku_service.dart:26-90`.
- Sending danmaku with a logged-in dandanplay account — `lib/services/dandanplay_service_io.dart:2548-2556`.
- Danmaku cache manager, density analysis (peak segments), and timeline danmaku service — `lib/services/danmaku_cache_manager.dart`, `lib/services/danmaku_density_analyzer.dart:303,333`, `lib/services/timeline_danmaku_service.dart`.
- AI anti-spoiler danmaku filtering against OpenAI-compatible or Google Gemini endpoints — `lib/services/danmaku_spoiler_filter_service.dart:7-12`; usage/privacy `Documentation/spoiler-ai.md`.
- Danmaku-to-ASS export with outline/shadow style options for external players — `lib/utils/danmaku_ass_converter.dart:13-28`, `lib/utils/external_player_danmaku_ass.dart`.

## Subtitles

- Subtitle management center: embedded-track switching, external subtitle loading onto the player, styling and stacking — `lib/utils/subtitle_manager.dart`, wired through `lib/utils/video_player_state/video_player_state_subtitles.dart`.
- Text formats ASS, SRT, SubViewer, MicroDVD parsed in-app — `lib/utils/subtitle_parser.dart:44-49`.
- Image subtitles: PGS `.sup` and VobSub `.sub`/`.idx`, with 4-byte header sniffing to distinguish VobSub binaries from MicroDVD text — `lib/utils/subtitle_manager.dart:379-392,1149-1160` (sniff optimization from commit `e5da6a5b`).
- Remote subtitle/audio/font candidates from WebDAV, SMB, dandanplay, and NipaPlay shared libraries — `lib/services/remote_subtitle_service.dart:20-158`.
- Subtitle font loading, language utilities, and legacy charset decoding — `lib/utils/subtitle_font_loader.dart`, `lib/utils/subtitle_language_utils.dart`, `lib/utils/subtitle_file_utils.dart`, `lib/utils/legacy_charset_decoder.dart`.
- Active HEAD focus (recent commit subjects): kernel-track subtitle stacking must not steal playback (`b098594d`), upstream subtitle selection persistence restored (`687c255c`), remote-picker guards (`ec05705b`, `dc756266`), menu index alignment when stacking (`aed6b42a`), persistent display-name registry for remote cache paths (`ac1657f4`), VobSub never auto-restored as primary (`bd562d80`).

## Media Library

- Local media scanning with Rust-accelerated file scan plus filename/identity parsing — `lib/services/scan_service.dart`, `lib/services/rust_file_scan_service.dart`, `rust/src/api/file_scan.rs`, `lib/utils/media_filename_parser.dart`, `lib/utils/media_identity_resolver.dart`.
- Emby integration: browse, playback sync, dandanplay matching, episode mapping, media-source catalog/selection, release-name parsing — `lib/services/emby_service.dart:42`, `emby_playback_sync_service.dart`, `emby_dandanplay_matcher.dart`, `emby_episode_mapping_service.dart`, `emby_media_source_catalog.dart`, `emby_release_name_parser.dart` (all under `lib/services/`).
- Jellyfin integration with the same matching/sync/mapping family — `lib/services/jellyfin_service.dart:45`, `jellyfin_playback_sync_service.dart`, `jellyfin_dandanplay_matcher.dart`, `jellyfin_episode_mapping_service.dart`.
- Server transcoding management and shared playback client/base — `lib/services/emby_transcode_manager.dart`, `lib/services/jellyfin_transcode_manager.dart`, `lib/services/media_server_playback_client.dart`, `lib/services/media_server_service_base.dart`.
- SMB network mounts via native smb2 FFI service and SMB proxy streaming — `lib/services/smb_service.dart:116`, `lib/services/smb2_native_service.dart` (+ `_ffi.dart`), `lib/services/smb_proxy_service.dart`, `packages/nipaplay_smb2/`.
- WebDAV mounts with search, file resolution, and legacy-server PROPFIND variants — `lib/services/webdav_service.dart:135,2059-2065`, `lib/utils/webdav_file_sorter.dart`.
- NipaPlay LAN media sharing: play directly from other NipaPlay devices with shared-library provider — `lib/services/local_media_share_service.dart`, `lib/services/local_media_management_api.dart`, `lib/providers/shared_remote_library_provider.dart`; `Documentation/user-guide.md:75-80`.
- Adaptive library UI: collection views, library management, section ordering, add-media flow — `lib/media_library/adaptive_media_library_page.dart`, `adaptive_media_collection_view.dart`, `adaptive_library_management_overview.dart`, `media_library_section_order_store.dart`, `adaptive_add_media_flow.dart` (all under `lib/media_library/`).
- Server detail page and WebDAV browser page — `lib/pages/media_server_detail_page.dart`, `lib/pages/webdav_browser_page.dart`.

## Downloads

- Torrent/magnet download engine implemented in Rust behind flutter_rust_bridge, with session management, configurable download directory, and iOS downloads-directory handling — `lib/services/torrent_download_service.dart:10,25`, `rust/src/api/torrent.rs`.
- Unified torrent page model, adaptive dialogs, magnet preview, and download page — `lib/downloads/unified_torrent_page_model.dart`, `lib/downloads/adaptive_torrent_download_dialogs.dart`, `lib/pages/torrent_download_page.dart`, `lib/models/torrent_magnet_preview.dart`; user docs `Documentation/torrent-download.md`.
- Downloader settings provider and settings page — `lib/providers/downloader_settings_provider.dart`, `lib/settings/pages/downloader_settings_content.dart`.

## Remote Playback & Control

- Built-in Web server exposing the library over HTTP — `lib/services/web_server_service.dart`; design `docs/WEB_SERVER_IMPLEMENTATION.md`.
- LAN remote control API with auth manager, access guard, settings, and client service for controlling another device's playback — `lib/services/remote_control_api_service.dart`, `remote_control_auth_manager.dart`, `remote_control_access_guard_service.dart`, `remote_control_settings.dart`, `remote_control_client_service.dart`, `player_remote_control_bridge.dart` (all under `lib/services/`); security guidance `Documentation/remote-access.md`.
- QR-code pairing payload/server info and camera scanner for remote access setup — `lib/services/remote_access_qr_service.dart:9,47,64,229`.
- LAN discovery protocol and responder for finding NipaPlay servers — `lib/services/nipaplay_lan_discovery.dart:8,22,79`.
- dandanplay remote-device control integration — `lib/services/dandanplay_remote_service.dart`, `lib/providers/dandanplay_remote_provider.dart`.
- Web remote access, web API, remote text input, and multi-address server connection — `lib/services/web_remote_access_service.dart`, `lib/services/web_api_service.dart`, `lib/services/remote_text_input_service.dart`, `lib/services/multi_address_server_service.dart`.
- Companion gateway servers: dandanplay gateway and nipaplay-region — `server/dandanplay-gateway/`, `server/nipaplay-region/`; dual-server design `docs/NIPAPLAY_GATEWAY_DUAL_SERVER.md`.
- Watch-history sync: server history sync, WebDAV-backed incremental sync with native codec/transport, full and category backups — `lib/services/server_history_sync_service.dart`, `incremental_sync_repository.dart`, `incremental_sync_native_codec.dart`, `full_backup_service.dart`, `backup_service.dart`, `auto_sync_service.dart` (all under `lib/services/`), `rust/src/api/incremental_sync.rs`.

## Bangumi & Anime Info

- Bangumi API integration (account, collection, rating, comments) and watch-progress sync — `lib/services/bangumi_service.dart:11`, `lib/services/bangumi_api_service.dart`, `lib/services/bangumi_sync_service.dart:19`; `README.md:166`.
- Seasonal anime timetable service and page — `lib/services/trending_bangumi_service.dart`, `lib/pages/new_series_page.dart`; `README.md:167`.
- Anime info aggregation with API/database/storage repositories — `lib/services/anime_info/anime_info_service.dart`, `api_repository.dart`, `database_repository.dart`.
- Random recommendations and tag search — `lib/services/random_recommendation_service.dart`, `lib/search/tag_search_controller.dart`.

## Playback Features

- Playback controls: play/pause, seek, multi-step speed (0.5x–2.0x), volume, fullscreen — `lib/utils/video_player_state/video_player_state_playback_controls.dart`; `Documentation/user-guide.md:11-15`.
- Multi-audio-track switching — `lib/utils/audio_track_manager.dart`.
- Chapter list parsed from player media info — `lib/utils/video_player_state/video_player_state_chapters.dart`, `lib/player_abstraction/player_data_models.dart:147`.
- Intro/credits skip via AniSkip (OP/ED only; mixed-op/mixed-ed/recap deliberately not adopted) plus danmaku-density intro detection — `lib/services/intro_skip/aniskip_service.dart:16-24`, `lib/services/intro_skip/danmaku_intro_detector.dart`, `lib/utils/video_player_state/video_player_state_intro_skip.dart`.
- Screenshot/frame capture and timeline preview thumbnails — `lib/utils/video_player_state/video_player_state_capture.dart`, `lib/utils/video_player_state/video_player_state_timeline_preview.dart`; Erika GIF clip export — `lib/player_abstraction/erika_gif_export.dart` (+ `_io`/`_stub`).
- Resume positions and auto-next-episode — `lib/services/playback_position_store.dart`, `lib/services/auto_next_episode_service.dart`, `lib/services/episode_navigation_service.dart`.
- External player handoff with console window, and desktop picture-in-picture preferences — `lib/services/external_player_service.dart`, `lib/pages/external_player_console_page.dart`, `lib/services/desktop_picture_in_picture_preferences.dart`.

## JS Plugin System

- JavaScript plugin runtime via flutter_js with per-platform factories (Web unsupported; OHOS via an FFI bridge because flutter_js has no OHOS implementation) — `lib/plugins/js_runtime_factory.dart`, `js_runtime_io.dart`, `js_runtime_web.dart`, `js_runtime_ohos.dart`, `pubspec.yaml:169-170`; `Documentation/js-plugin-api.md:24-27`.
- Plugin service with manifest/permission model, event bus, sandboxed storage; built-in asset plugins plus external import directory — `lib/plugins/plugin_service.dart`, `plugin_event_bus.dart`, `plugin_storage.dart`, `Documentation/js-plugin-api.md:8-20`.
- Plugins can extend playback control, danmaku filtering/rendering, UI, and storage — `Documentation/js-plugin-api.md:6-8`, `lib/services/plugin_playback_service.dart`, `lib/plugins/danmaku/`, `lib/plugins/url_resolver.dart`.

## Platform Support

- Platforms per matrix: Windows x64 release (ARM64 build-dependent), macOS Intel/Apple Silicon, Linux amd64/arm64, Android APK, iOS App Store; tvOS and HarmonyOS source builds — `Documentation/platform-matrix.md:5-14`, `README.md:92`.
- Platform host projects: `android/`, `ios/`, `linux/`, `macos/`, `windows/`, `web/`, `tvos/`, `ohos/` (HarmonyOS/OpenHarmony), `harmonyos_test/`; tvOS guide with dedicated Flutter fork — `docs/TVOS_DEVELOPMENT.md`.
- TV/large-screen mode with TV/tvOS detection flags — `lib/utils/globals.dart` (`isTelevision`, `isTvOS`), `lib/services/large_screen_ui_sfx_service.dart`.
- Desktop windowing: macOS platform menu, player window service with startup size/position, dark solid startup background, first-frame show — `lib/platform_menu/macos_platform_menu.dart`, `lib/services/desktop_player_window_service.dart`, `lib/services/desktop_startup_window_preferences.dart` (fixes `6b5f0ddc`, `10f805da`, `84e9cb2d`).
- Desktop lifecycle: exit handling, single-instance guard, file-association launch handling — `lib/services/desktop_exit_handler.dart`, `lib/services/single_instance_service.dart`, `lib/services/file_association_service.dart`, `lib/utils/launch_file_handler.dart`.
- Per-platform storage: Android SAF, iOS container path fixing, Linux/macOS storage migration, security bookmarks — `lib/services/android_saf_service.dart`, `lib/utils/ios_container_path_fixer.dart`, `lib/utils/linux_storage_migration.dart`, `lib/utils/macos_storage_migration.dart`, `lib/services/security_bookmark_service.dart`.
- Packaging/distribution: Homebrew cask, AUR, Gentoo ebuild, Flatpak manifest, arm64 Dockerfile, unsigned iOS sideload CI workflow, dmg/build scripts — `README.md:117-145`, `io.github.MCDFSteve.NipaPlay-Reload.yaml`, `Dockerfile.arm64`, `gentoo/media-video/nipaplay-bin/`, `dmg.sh`, `thin-payload.sh` (sideload dispatch commit `33c0be39`).
- Update checking against GitHub releases — `lib/services/update_service.dart`, `lib/utils/github_accel_resolver.dart`.

## UI & Personalization

- Two selectable UI themes — NipaPlay and Cupertino — with light/dark and auto dark mode, custom background images — `lib/themes/theme_registry.dart`, `lib/themes/nipaplay/`, `lib/themes/cupertino/`, `lib/providers/ui_theme_provider.dart`, `lib/providers/theme_background_reveal_provider.dart`; `README.md:172`.
- Global and in-app keyboard shortcuts with a shortcuts settings page — `lib/utils/hotkey_service.dart`, `lib/utils/global_hotkey_manager.dart`, `lib/services/hotkey_service_initializer.dart`, `lib/pages/shortcuts_settings_page.dart`; `README.md:173`.
- Localization framework and language settings — `lib/l10n/`, `l10n.yaml`, `lib/providers/app_language_provider.dart`.
- Unified adaptive settings system: general, appearance, player, danmaku, network, storage, language, labs, developer options, external player, plugin, remote-media pages — `lib/settings/unified_settings_page.dart`, `lib/settings/pages/`.
- Labs/experimental feature flags provider — `lib/providers/labs_settings_provider.dart`.
- Adaptive app shell with unified pages and virtual windows — `lib/app/unified_app_pages.dart`, `lib/app/unified_app_view_presenter.dart`, `lib/app/unified_app_virtual_windows.dart`.

## Architecture Notes

- Rust+Dart hybrid core bridged with flutter_rust_bridge: next2/DFM+ danmaku engines, torrent client, file scan, media probe/metadata, incremental sync, WebDAV multistatus, ASS conversion, danmaku analytics, performance — `rust/src/api/`, `flutter_rust_bridge.yaml`; `README.md:178`.
- In-repo vendored/forked third-party components: mpv, libplacebo, media-kit upstream, QuickJS C bridge, smb_connect, volume_controller, fvp — `third_party/`; local packages incl. `packages/media_kit/`, `packages/media_kit_video/` (`CONTRIBUTING_GUIDE/02-Project-Structure.md:37-44`).
- Player state orchestration centered on `VideoPlayerState`, split into part files for init, player setup, playback controls, danmaku, subtitles, capture, chapters, intro skip, streaming, timeline preview, navigation, lifecycle, preferences, metadata — `lib/utils/video_player_state.dart`, `lib/utils/video_player_state/` (`CONTRIBUTING_GUIDE/02-Project-Structure.md:76-96`).
- State management via Provider with global providers registered at startup — `lib/main.dart`, `lib/providers/`.
