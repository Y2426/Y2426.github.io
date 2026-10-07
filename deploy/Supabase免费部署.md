# GitHub + Supabase 免费版部署

状态：GitHub Pages 与 Supabase 已上线，管理员后台可用。自定义域名尚未切换。以下为初始化与维护说明；不要在现有项目重复执行初始化迁移。旧香港服务器已退，不再依赖它。

## 组成

- GitHub 保存审核后的代码，Actions 构建 `dist` 并发布 Pages。也可把相同静态目录发布到 Cloudflare Pages。
- Supabase Auth 管理密码和会话；PostgreSQL 保存课程、账号权限、学习记录及兑换码。
- `echo_private` 非公开 schema 的表全部启用 RLS。客户端只调用受权限检查的 `echo_api`，不能直接修改管理员或会员字段。
- `echo-media` 是私有桶，文件访问经过权限判断并生成两小时签名链接。已经签发的链接在到期前仍有效（下架不会立即撤回该链接）。
- 支付和 AI 均关闭。本版只发放资料库兑换码，不发放 AI 积分。

## Supabase 初始化（免费项目）

1. 选择 Free 组织，建立专用 Echo 项目；数据库密码由项目拥有者本人设置并保存，不要放进代码仓库。
2. 在 SQL Editor 执行 `supabase/migrations/202610070001_echo.sql`，只执行一次；这是新项目迁移，不要对已有项目盲目重复执行。
3. 第一版采用用户名 + 密码：Auth 邮箱密码登录保持开启，关闭 Confirm email。这里使用 `用户名@accounts.myecho.fun` 作为内部账号标识，并非已验证联系邮箱。不要把该字段显示成“验证邮箱”。关闭验证是该模式的必要设置，需由项目拥有者确认。不发送邮件，也不提供邮件找回；未来升级真实邮箱需要单独迁移。
4. 设置最短密码 10 位；正式开放前配置注册防滥用与 Auth 限流。限制不要设为无限。免费额度也需要监控。
5. 网站注册新的专用管理员账号；在 Authentication > Users 核对其 UUID，再在 SQL Editor 执行：
   `update echo_private.profiles set admin=true where id='核对过的用户 UUID';`
   不要根据“第一个注册用户”自动授予管理员，旧 SQLite 密码与管理员身份不会自动迁入。
6. 运行 `node scripts/prepare-supabase-seed.mjs`。按 `data/supabase/media-manifest.json` 将三份素材上传私有桶，再执行 `data/supabase/seed.sql`。未确认版权的参考素材不发布。

## GitHub 发布

仓库不要直接上传整个工作目录。特别排除 `data`、数据库、备份、旧部署记录、私钥、截图、环境文件和用户素材。源码提交前再次检查暂存文件。

设置 Repository Variables：

- `SUPABASE_URL`：项目 URL，例如 `https://项目编号.supabase.co`。
- `SUPABASE_PUBLISHABLE_KEY`：publishable key 或 legacy anon key（公开客户端用途）。绝不能填写 secret / service_role key。
- `SITE_DOMAIN`：使用自己的域名时填 `myecho.fun`。

Pages 的 Source 选择 GitHub Actions。`.github/workflows/pages.yml` 会先测试再发布。

网站路径目前以根路径为准：使用 `myecho.fun` 或 `用户名.github.io` 根站点。不支持直接部署到 `/仓库名/` 子路径。

DNS 切换前，在 GitHub Pages 中核实该站点对应的官方解析目标；不要继续指向已退的香港服务器。待证书就绪再强制 HTTPS。GitHub Pages 有平台用途限制，后续商业化应重新评估托管服务条款。

## 本地构建

在本地环境或 GitHub Variables 配置公开 URL/key 后运行 `npm run build:static`。只上传 `dist`，不要上传整个项目。构建会拒绝误填的私密密钥。

## 验收

- 未登录可看公开课程，不能看受限课程原文及媒体。
- 普通用户无法读取后台、兑换码列表、他人学习记录，也无法上传媒体。
- 注册、登录、退出、跨设备学习记录同步、密码修改可用。
- 管理员创建/编辑草稿、发布、下架、恢复、版本冲突保护可用。
- 后台生成兑换码、下载、停用；错误/过期/已用码不能兑换；成功兑换绑定当前账号；并发兑换不能双重消费。
- 付款与 AI 请求拒绝执行。
- 在国内网络用 QQ/Gmail 用户所在的真实网络测试网站与 Supabase 可达性；免费海外托管不承诺国内访问质量。

免费额度不是无限量。单文件上限按当前免费桶配置 50 MB；优先压缩视频，并定期导出数据库备份。现有本地初始备份不能保证包含退服前后新增的全部用户数据。

