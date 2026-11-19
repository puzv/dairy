# dairy

山笺是一个手机优先的私人日记网站。按日期写中文日记，从时间线打开、编辑并重新读回。标题可留空，时间线会取正文的第一行。

当前版本使用 Prisma 6.19.3 和 PostgreSQL。网页访问仍仅限本机；项目只支持在本机使用用户名和密码注册、登录，不会发送邮件，也没有远程账号或公开访问路径。PostgreSQL 由 `DATABASE_URL` 选择，可以是远程测试数据库。所有日记仍按登录账号隔离。

## 本地运行

本项目面向 Windows、Node.js 24、npm 和 PostgreSQL。请先准备一个可通过 `DATABASE_URL` 连接的 PostgreSQL 数据库，不要重置或删除已有的 Docker 卷和数据库数据。

```powershell
Copy-Item .env.example .env
# 编辑 .env，把 DATABASE_URL 换成你自己的数据库连接串
npm ci
npm run db:migrate
npm run dev
```

浏览器打开 [本地日记](http://127.0.0.1:3000)。`npm ci` 的 `postinstall` 会运行 `prisma generate`；`npm run build` 也会先生成 Prisma Client，因此干净安装和构建不依赖已有生成物。

`DATABASE_URL` 只放在被 `.gitignore` 忽略的 `.env` 中；`.env.example` 只包含占位值，其中的 `127.0.0.1` URL 只是示例，不代表数据库必须运行在本机。应用不会在构建时读取或连接数据库。不再需要 `DIARY_PASSWORD`、会话签名密钥或其他认证环境变量；账号和会话都由 `DATABASE_URL` 指向的 PostgreSQL 保存。

## 本地账号与登录

- `/login` 和 `/register` 互相链接。已登录时访问这两个页面都会转到 `/timeline`；未登录访问受保护页面会转到 `/login`。
- 用户名在服务端先去除首尾空白，再转成小写，只接受 ASCII `[a-z0-9_]`，长度为 3–32。数据库对 `users.username` 建立唯一索引；并发注册的 `P2002` 唯一键冲突会按类型识别，并显示友好的“用户名已被使用”。
- 密码不做 trim，长度必须在 8–128 个字符之间，并额外限制 UTF-8 不超过 512 字节。登录和注册使用同一套校验，避免两者规则不一致。注册还必须再次输入确认密码；服务端会在哈希和数据库操作之前校验两次输入一致，缺失或不一致时返回 `confirmPassword` 字段错误，确认密码不会被保存或记录。
- 密码使用 Node `crypto.scrypt` 异步派生，参数固定为 `N=32768`、`r=8`、`p=1`，`maxmem` 设为 64 MiB，每个密码使用 16 字节安全随机盐。数据库只保存带版本和参数的严格编码，例如 `scrypt$v1$32768$8$1$<salt>$<key>`，不保存原始密码。
- 登录时严格解析该编码，并用 `timingSafeEqual` 比较固定长度的派生键。账号不存在、旧账号没有密码摘要或密码错误时，都返回同一条通用错误；不存在或旧账号会执行同样的 dummy scrypt 校验，避免通过响应差异探测账号。
- 注册要求用户名、密码和确认密码，成功后在同一数据库事务中创建用户和首个会话，然后自动登录。`displayName` 直接使用规范化后的用户名。事务失败不会留下只注册了一半的账号。
- 会话令牌是 Node `crypto` 生成的 32 字节随机不透明值（base64url）。数据库 `sessions.token_digest` 只保存该令牌的 SHA-256 十六进制摘要，并有唯一索引；原始令牌只存在于浏览器 Cookie 和服务进程内，不写入数据库或日志。
- `sessions.expires_at` 带有索引。每次签发会话时，会在同一事务内最多清理 100 条已过期记录，避免无界全表扫描。查询会话时服务端会再次比较到期时间，过期即视为未登录。
- Cookie 名为 `shan_jian_session`，有效期 24 小时，设置为 `HttpOnly`、`SameSite=Strict`、`Path=/`，不要求 `Secure`，因此可在本地 HTTP 上使用。会话保存在数据库，进程重启后仍然有效。
- 每个浏览器登录都会获得独立会话；退出登录只删除当前 Cookie 对应的摘要，不会影响同一账号的其他浏览器会话。
- `(app)` 布局会在渲染前调用 `requireDiarySession()`；每个读写日记的页面和 Server Action 仍会各自调用 `requireUser()`，先验证来源和数据库会话，再访问日记表。`ownerId` 只来自当前会话，从不接受客户端传入。
- 登录和注册页面、认证与退出 Server Action 都各自执行 loopback 检查，不依赖 proxy 作为唯一防线。

旧的固定本地身份不会被自动创建、登录或认领。迁移后它只是 `username` 和 `password_hash` 都为 `NULL` 的普通遗留行，已有条目继续引用它，但没有可用凭据。只有通过下面记录的、由所有者确认的手工迁移，才可以把这些条目转给新账号。

## 数据库迁移

```powershell
npm run db:migrate     # 本地开发：prisma migrate dev
npm run db:deploy      # 已提交迁移：prisma migrate deploy
npm run db:status      # 查看迁移状态
npm run db:studio      # 打开 Prisma Studio
```

账号与会话迁移位于 `prisma/migrations/20260102000000_username_auth_sessions/`，是初始迁移之后的增量迁移。它只新增 `users.username`、`users.password_hash`、唯一索引、凭据成对约束和 `sessions` 表；不修改初始迁移，也不删除既有用户、日记或 Docker 数据。旧用户迁移后两个凭据字段都为 `NULL`，因此数据库中的成对 `CHECK` 约束仍然成立。

### 回滚注意

- 执行任何迁移前先备份 `DATABASE_URL` 指向的数据库，并确认备份可以恢复。迁移没有自动 down migration，不要编辑初始 SQL 来“回滚”。
- 如果迁移失败，不要手工 `DROP` 表、约束或列来逆转：这会绕开 Prisma 的迁移历史，使 `_prisma_migrations` 与真实 schema 不一致。应先保留现场，把已验证的备份恢复到独立数据库核对；确认数据后再用新的前向迁移修复 schema，并确保 Prisma 迁移历史与数据库实际结构一致。
- 不要执行 `prisma migrate reset`、`docker compose down -v`、删除卷或重建数据库来修复迁移。已有数据库数据不属于项目的迁移流程。

## 旧固定身份的手工转移（仅文档）

应用不会自动认领旧身份，也没有转移页面。只有在能确认“当前机器和数据库确实属于原所有者”的情况下，才可手工转移：

1. 先确认“当前机器和数据库确实属于原所有者”；若无法确认，停止操作。
2. 通过正常注册创建一个新账号，记下它的用户 UUID，并先用该账号正常登录一次，确认账号可用。
3. 停止应用，并完整备份数据库。
4. 确认遗留用户 UUID 为 `00000000-0000-4000-8000-000000000001`，并核对待转移的日记数量。
5. 在应用外完成所有者确认（例如由能接触原机器和原数据的人确认），不要仅凭网页输入。
6. 确认新账号 UUID 无误后，在一个显式事务中把日记的 `owner_id` 从遗留 UUID 改为新账号 UUID：

```sql
BEGIN;

-- 仅在完成备份和所有者确认后执行；<new-user-uuid> 必须替换为已核对的新账号。
UPDATE "entries"
SET "owner_id" = '<new-user-uuid>'
WHERE "owner_id" = '00000000-0000-4000-8000-000000000001';

COMMIT;
```

7. 重新启动应用，用新账号逐条抽查日记后，再决定是否保留遗留用户行。

这是手工、所有者确认后的数据操作，不属于注册流程，也不会自动执行。

## 验证

```powershell
npm run lint
npm run typecheck
npm run build
```

1. 未登录时打开 `/timeline`，应跳转到 `/login`。注册新账号后应自动进入 `/timeline`；再次访问 `/login` 或 `/register` 会直接回到时间线。
2. 用错误密码、不存在的用户名或旧账号名登录，都应看到同一条通用错误。重复注册同一用户名应显示用户名已被使用，而不是数据库错误。
3. 输入少于 8 个字符或过长的密码，登录和注册应分别被拒绝；注册时缺少确认密码或两次输入不一致也应被拒绝，密码首尾空格必须按原样参与校验。
4. 登录后重启开发服务，会话仍应有效。在两个浏览器分别登录同一账号，退出其中一个不应影响另一个。
5. 写一篇不带标题的中文日记，手动保存。刷新后回到时间线，用正文首行找到它，重新打开并编辑。
6. 在两个标签页打开同一篇的编辑页。先保存一处，再保存另一处。后者会提示版本冲突，并保留表单中的文字。
7. 注册第二个账号，确认看不到第一个账号的日记；直接访问其日记 UUID 应显示「这一页不存在」。
8. 用非开发环境启动，或用非 loopback 的 Host 访问，应被拒绝；认证和日记 Server Action 也会各自执行这项检查。

## 实现范围

Next.js App Router、React、TypeScript 和 Tailwind CSS 构成应用层。Prisma 访问 PostgreSQL；`users` 通过外键关联 `entries` 和 `sessions`，日期使用 PostgreSQL `date`，UUID 使用原生 `uuid`，时间戳使用 `timestamptz`，情绪使用 `smallint`。初始迁移包含标题、正文、情绪和版本约束，以及只覆盖未删除记录的时间线部分索引。

编辑通过一条带 `id`、`owner_id`、`version` 和 `deleted_at` 条件的 `UPDATE` 完成比较并交换；版本不匹配时不会覆盖新内容。所有页面和 Server Action 都先通过 `requireUser()` 验证本机来源、数据库会话和用户，再用会话中的用户 ID 取得 `ownerId`，并在读取、创建和更新条件中强制使用它。

本阶段使用手动保存。自动保存与离线草稿、标签搜索、回收站、导出和远程发布按规划留到后续阶段。

## 部署说明

当前版本只面向本地使用，不提供生产部署方案。生产路由会拒绝访问，且不受账号或环境变量配置影响：非 loopback Host 或 `NODE_ENV` 不是 `development` 时都返回 404。新增本地账号不会改变这一点；需要远程使用时，应另行设计真实的远程认证与部署方案，而不是放宽 Host 或环境判断。
