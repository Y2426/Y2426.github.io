# YouTube 自动整理为 Supabase 课程草稿

已实现采集程序和每周任务配置，尚未接入真实凭据、运行首条云端导入或启用计划。不会调用发布接口；课程在原管理后台预览、修改和手动发布。

## 来源与数量

`sources.json` 的建议配额为每周最多 20 条：

| 来源 | 分类 | 每次上限 |
| --- | --- | --- |
| [Michelle Choi](https://www.youtube.com/@michellechoii) | 日常 Vlog | 5 |
| [Nathaniel Drew](https://www.youtube.com/@nathanieldrew) | 生活、旅行 Vlog 候选 | 5 |
| [TED](https://www.youtube.com/@TED) | 演讲与成长 | 6 |
| [Vogue](https://www.youtube.com/@Vogue) | 名人访谈，标题筛选 73 Questions / interview | 4 |

这些是可修改的候选来源，不保证每期都符合要求。频道混合内容仍需在草稿中检查。默认只扫描各来源前 40 条，处理 20 秒到 15 分钟的英语视频，以纳入有口语的 Vlog；当前不自动裁切长视频。配额是处理尝试上限，失败也计入，不会为凑数无限下载或调用 AI。已有课程不计入配额；已下架和手动修改的课程也不会覆盖。每类不足时不会借用其他类别配额。

## 处理与适配

1. yt-dlp 扫描频道或播放列表、获取视频；排除直播、超时长素材。
2. FFmpeg 转为 H.264/AAC MP4，480p，控制在现有私有桶 50 MiB 限制内。
3. faster-whisper 本地识别英语，生成逐词时间戳。无需付费语音识别 API，但首次会下载模型。
4. 按逐词区间调用兼容 Chat Completions 的 JSON 模型，选择自然语义边界并翻译。每句最多 12 秒、28 个词；模型不允许改写英文或生成时间戳。
5. 检查词序全覆盖、不重复、时间不重叠、不超视频；拒绝空翻译。口语词时长占比低于 35% 或低置信度词超过 15% 时失败，不入库。
6. 输出网站已有 `cues: [{start,end,text,translation}]` 和 `vocabulary: {word: [phonetic,meaning]}`；兼容单句循环、AB 复读、听写、重点词、生词本。
7. 私有视频上传后，通过现有管理员 `echo_api` 创建草稿，保留来源链接和质量标记。审核时仍应试听句首句尾；自动对齐和翻译不保证百分之百正确。

## 一次性配置

GitHub Pages 不能执行下载和转码；任务在 GitHub Actions 的 Linux runner 上运行，直接写现有 Supabase。使用现有 `echo_api` 和 `echo-media`，无需重新执行数据库迁移。

在仓库 Settings → Secrets and variables → Actions 设置：

| 类型 | 名称 | 用途 |
| --- | --- | --- |
| Variable | `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY` | 沿用网站公开配置 |
| Secret | `INGEST_ADMIN_USERNAME`、`INGEST_ADMIN_PASSWORD` | 专用采集管理员账号，按现有用户名账号体系登录 |
| Secret | `AI_API_KEY` | DeepSeek API Key |
| Variable（可选） | `AI_API_URL` | 默认 `https://api.deepseek.com/chat/completions` |
| Variable（可选） | `AI_MODEL` | 默认 `deepseek-flash`，可按账号可用模型调整 |
| Variable | `YOUTUBE_INGEST_ENABLED` | 设为 `true` 时允许任务运行 |

不要将密码、私密 API key 或 service-role key 填进网页或提交到仓库。当前代码使用管理员登录，未使用 service-role key。采集账号需按既有部署文档授予管理员权限。

先把 `sources.json` 的 `enabled` 设为 `true`，手动运行 **YouTube to course drafts**，`max_per_run` 保持默认 1，检查一条真实草稿。每周任务自动使用 20 条上限。本机可设置 `INGEST_MAX_PER_RUN=1` 做同样的首条验收。计划时间为每周一北京时间 09:00；GitHub 调度可能延迟。工作流和启用后的配置需存在于默认分支，任务最长 330 分钟。YouTube 对云机房的限制可能导致下载失败，届时可用能正常访问 YouTube 的本机或服务器运行同一程序。

## 本机运行

安装 Node.js 24、Python 3.11+、FFmpeg（含 ffprobe）：

```powershell
npm ci
python -m pip install -r ingestion/requirements.txt
Copy-Item ingestion/.env.example ingestion/.env
# 在本地编辑 ingestion/.env，填写配置，不要把密钥发到聊天中。
npm run ingest:check
node --env-file=ingestion/.env ingestion/worker.mjs
```

`INGEST_PYTHON` 可以指定 Python 可执行文件绝对路径；`WHISPER_MODEL` 默认 `small`，可以改成 `medium` 提升识别质量（耗时和内存增加）。使用多语言模型检测素材是否为英语。`INGEST_CONFIG` 可指定其他来源配置，`INGEST_STATE_DIR` 可指定处理目录。更改模型、筛选或断句配置后，旧的缓存不会自动重新生成；需要先备份并移走对应未入库任务目录，再重试。

Linux/Actions 处理结果在 `data/youtube-ingest/`，Windows 默认在 `%LOCALAPPDATA%/EchoShadowing/youtube-ingest/`：原视频、转码视频、逐词识别结果、双语 SRT、课程 JSON 和 `last-run.json`。凭据不写入这些文件。正常退出会移除进程锁；异常断电后需确认无任务运行再删除 `worker.lock`。媒体、模型会占用磁盘，请定期清理已成功任务的本地文件。

GitHub 每次运行上传报告和双语字幕工件，保留 7 天；不上传原视频到 Git 仓库。失败任务在下一次扫描仍会重试，直到它不再处于扫描窗口。云端媒体按内容哈希去重，数据库写入失败后可复用同一媒体。并发运行由 GitHub concurrency 和本机锁限制；不要同时在多个机器启动同一采集配置。

20 条不是固定免费额度：每周可能新增数百 MB 媒体，并消耗 Actions 计算时间、Supabase 存储及模型 token。当前没有自动清理云端素材，空间不足会失败并记录，不能视为已入库。

## 开源复用

- [yt-dlp](https://github.com/yt-dlp/yt-dlp)：频道/播放列表扫描与获取；按官方 Python API 集成。
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)：逐词语音识别，MIT license。
- [FFmpeg](https://ffmpeg.org/)：转码；发行包的许可取决于构建配置。

本项目新增的是网站课程适配、质量校验、去重和草稿入库层。源码依赖的许可与视频素材的使用授权是两件事；候选来源不代表已取得素材再发布授权。
