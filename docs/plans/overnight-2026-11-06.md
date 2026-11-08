# 2026-11-06 夜里：改前循环和全套测试

> Leo 2026-11-06 晚：「今晚把下面的一次跑完，中间不用等我」，第 0 步到第 6 步。跑完就停，不提交、不推送。
> 每一步的数字也写进了 `docs/decisions.md` 的 Open items，"A browser test that times out…" 下面的 "The night of 2026-11-06"。

**结果先说**

- 七步都跑完了，每一步都是 exit 0，中途没有哪一步失败，也没有哪一步重跑。
- **改前循环 2,000 次**（第一个 1,000 次只有 1 次卡住，不到 3 次，照计划又跑了 1,000 次）：
  - 断连 1 次、卡住 3 次、画不出来 1 次，一共 3 次打开出了事；
  - **3 次都是某个浏览器的第一次打开**：80 次第一次打开里出了 3 次，其余 1,920 次一次都没有；
  - 卡住的时长都接近 10 秒的整数倍：30 秒、20 秒、50 秒，后面的字体再 10 秒；
  - 出事时电脑不忙：CPU 最高 29–55%，硬盘 89% 以上空闲；
  - 服务器的主线程三次里卡了两次，第三次（#526）没卡；
  - 本机连线放行一步一步，每步约隔 10 秒，浏览器和心跳都一样。
- **全套测试**：164 个文件，3,497 条全过，exit 0，约 75 分钟。
- **系统日志**：20:02 到 23:26 之间没有 42、506、507、107、187 号事件。19:41:32 有一对 506/507，是电脑醒来那一刻，在第 0 步之前。
- 安全软件方面：这台电脑装着 **Norton 360**，它的防火墙和 VPN 服务都在运行；Windows Defender 没在运行，网络保护是关的；没有 VPN 网卡。

## 每一步的时间和 exit code

| 步 | 开始 | 结束 | exit |
|---|---|---|---|
| 0 开跑前检查 | 20:02:08 | 20:02:40 | — |
| 1 首页计时改用 responseEnd | 20:02:40 | 20:03:29 | 单元测试 0 |
| 2 只读查三件事 | 20:03:56 | 20:04:45 | — |
| 3 拍照一组 | 20:04:45 | 20:13:12 | 0 |
| 4 改前循环，前 1,000 次 | 20:13:38 | 21:11:00 | 0 |
| 4 改前循环，后 1,000 次 | 21:11:22 | 22:10:23 | 0 |
| 5 全套测试 | 22:10:47 | 23:26:21 | 0 |
| 6 收尾检查 | 23:26:25 | 23:26:35 | — |

## 第 0 步

- `git status` 和关机前一样：4 个改过的文件、9 个新文件，提交是 `664b570`。
- 插着电，关屏、睡眠、休眠都是"从不"。
- 测试用的端口都空着。
- 有一个 `node.exe`（PID 1776）不是我们的：Codex 的 `artifact-tool` 后台程序，19:42:25 启动。我没动它。
- **开机时间**：系统日志显示电脑不是关机后重新开的，而是 17:57:07 进了睡眠，19:41:32 醒来。
  - 睡眠：42 号 "Application API"；187 号的调用者是 `winlogon.exe`；566 号 Reason 17。
  - 醒来：电源诊断写着 "The system has returned from a low power state"，Wake Source 是 Unknown；Kernel-Boot 27 号写着 "The boot type was 0x1"。
- 第 3 步在醒来 23 分钟后才开始，超过你要求的 10 分钟。

## 第 1 步：首页改用 responseEnd

- 先把旧算法原样搬进 `resetLoopStats.mjs`，变成一个能测的函数 `ownTimes()`。用试跑第一次打开的数据写测试。
- 在旧算法上是红的：应该是 140，旧算法给出 10,618。
- 改成首页用 `responseEnd − startTime`，其他文件照旧用它们自己的 `duration`。
- 全部单元测试：125 个文件，3,149 条全过，exit 0（多了 2 条）。

## 第 2 步：三件事的原文（只读，什么都没改）

**一、试跑时卡住的那两下心跳，服务器有没有记到对应的"连接打开"：没有。**

心跳那两行：

```
{"t":"2026-11-07T01:50:01.909Z","ms":9796,"status":null,"bytes":null,"error":"fetch failed: UND_ERR_SOCKET"}
{"t":"2026-11-07T01:50:12.456Z","ms":9899,"status":null,"bytes":null,"error":"fetch failed: UND_ERR_SOCKET"}
```

同一段时间里，服务器的连接记录：

```
{"t":"2026-11-07T01:50:01.624Z","ev":"conn","id":1,"remote":54828,"family":"IPv6"}
{"t":"2026-11-07T01:50:01.625Z","ev":"conn","id":2,"remote":52553,"family":"IPv6"}
{"t":"2026-11-07T01:50:01.648Z","ev":"conn","id":3,"remote":52554,"family":"IPv6"}
{"t":"2026-11-07T01:50:01.649Z","ev":"conn","id":4,"remote":51578,"family":"IPv6"}
{"t":"2026-11-07T01:50:01.650Z","ev":"conn","id":5,"remote":57748,"family":"IPv6"}
{"t":"2026-11-07T01:50:01.652Z","ev":"conn","id":6,"remote":57217,"family":"IPv6"}
{"t":"2026-11-07T01:50:07.634Z","ev":"conn-close","id":1,"hadError":false,"bytesRead":212,"bytesWritten":829,"ageMs":6010}
{"t":"2026-11-07T01:50:07.666Z","ev":"conn-close","id":3,"hadError":false,"bytesRead":212,"bytesWritten":829,"ageMs":6018}
{"t":"2026-11-07T01:50:11.938Z","ev":"conn","id":7,"remote":55138,"family":"IPv6"}
{"t":"2026-11-07T01:50:12.042Z","ev":"conn","id":8,"remote":55139,"family":"IPv6"}
{"t":"2026-11-07T01:50:18.047Z","ev":"conn-close","id":7,"hadError":false,"bytesRead":212,"bytesWritten":829,"ageMs":6109}
{"t":"2026-11-07T01:50:18.081Z","ev":"conn-close","id":8,"hadError":false,"bytesRead":212,"bytesWritten":829,"ageMs":6039}
{"t":"2026-11-07T01:50:22.363Z","ev":"conn","id":9,"remote":64467,"family":"IPv6"}
{"t":"2026-11-07T01:50:22.364Z","ev":"conn","id":10,"remote":64465,"family":"IPv6"}
```

- 第一下心跳从 01:50:01.909 等到 11.705。这段时间里服务器没有打开任何新连接：上一个新连接是 1–6 号，在 .624–.652，那时这一下还没发出；下一个是 7 号，在 11.938，那时这一下已经失败了。
- 第二下从 12.456 等到 22.355。下一个新连接是 9、10 号，在 22.363–.364，也是失败之后。
- 当时开着的旧连接（1、3 号，7、8 号），每个都只读到 212 字节，也就是心跳之前那一个请求。
- 所以这两下的请求都没有到服务器，不管走的是新连接还是旧连接。

**二、杀毒、安全、VPN 软件**

```
Windows 安全中心 AntiVirusProduct:
  Norton 360        productState 266240  C:\Program Files\Norton\Suite\wsc_proxy.exe
  Windows Defender  productState 393472  windowsdefender://
Windows 安全中心 FirewallProduct:
  Norton 360        productState 266240
Defender 状态: AMRunningMode Not running, AntivirusEnabled False,
  RealTimeProtectionEnabled False, NISEnabled False
Defender 服务: WinDefend Stopped, WdNisSvc Stopped
Get-MpPreference: 失败 0x800106ba
网络保护: HKLM\SOFTWARE\Microsoft\Windows Defender\Windows Defender Exploit Guard\Network Protection
  EnableNetworkProtection 0（没有组策略那一项）
已安装的安全或 VPN 程序: Norton 360 26.10.11201.2729, Gen Digital Inc.（没有别的）
正在运行的 Norton 服务: Norton Antivirus, Norton Firewall Service, Norton Tools, Norton VPN, NortonWscReporter
网卡（含隐藏的）: Wi-Fi (Intel BE200)、蓝牙、Windows 自带的 WAN Miniport、6to4、Teredo、IP-HTTPS、内核调试——没有 VPN 网卡
hosts 文件: 3 行 Norton 自己的（gen digital helper server），没有 localhost 那一行
```

- 也就是说：Defender 没在运行，它的网络保护是关的。在运行的是 Norton 360 的杀毒和防火墙，还有 Norton VPN 这个服务，但没有 VPN 网卡。

**三、localhost 还是 127.0.0.1**

- 浏览器、心跳、服务器用的都是 `localhost`：`previewServer.mjs` 给出的是 `http://localhost:<端口>`，循环把这个地址交给页面和心跳。
- 在这台电脑上，`localhost` **先解析成 `::1`**，再是 `127.0.0.1`：
  - Node：`dns.lookup` 默认给 `::1`（IPv6），全部结果是 `[::1, 127.0.0.1]`，结果顺序设置是 "verbatim"；
  - .NET 和 `Resolve-DnsName` 也是 `::1` 在前；
  - 地址优先表里 `::1/128` 的优先级是 50，排第一。
- 服务器**只在 `[::1]` 上监听**：`vite.config.ts` 没有设 host，所以 Vite 监听 "localhost"。第 3 步跑的时候看到的是 `TCP [::1]:4177 [::]:0 LISTENING 38068`，38068 就是服务器自己的进程号。
- 试跑和循环里，每一个连接都是 `"family":"IPv6"`。

## 第 3 步：拍照一组

- 命令：`node scripts/pixelShots.mjs dist <scratch>/night/px`，构建 `index-DXl3ZdsD.js`。
- 拍了 45 张，开了 25 次页面。
- 服务器记录写出来了，971 行：
  - 100 个连接、165 个请求；
  - 最慢的请求 32 毫秒，没有被断开的请求，没有连接出错；
  - 主线程每秒的记录 503 条，启动时卡了一次，282 毫秒；
  - 最后一条是停止。

## 第 4 步：改前循环（汇总原文）

前 1,000 次（20:13:38–21:11:00）：

```
1000 openings: 0 reset, 1 stalled past 5 s, 0 blank
  Cormorant latin woff2: n 500, median 67 ms, slowest 1% 90 ms, slowest 10059 ms
  Inter latin woff2: n 1000, median 60 ms, slowest 1% 106 ms, slowest 10109 ms
  /assets/three-C6wp6xxT.js: n 1000, median 49 ms, slowest 1% 70 ms, slowest 30116 ms
  /assets/index-DXl3ZdsD.js: n 1000, median 44 ms, slowest 1% 65 ms, slowest 30065 ms
  /assets/react-i_nGBwMY.js: n 1000, median 38 ms, slowest 1% 60 ms, slowest 30063 ms
  /assets/index-C679l0R0.css: n 1000, median 31 ms, slowest 1% 54 ms, slowest 30061 ms
  /: n 1000, median 9 ms, slowest 1% 19 ms, slowest 139 ms
```

后 1,000 次（21:11:22–22:10:23）：

```
1000 openings: 1 reset, 2 stalled past 5 s, 1 blank
  Cormorant latin woff2: n 499, median 67 ms, slowest 1% 123 ms, slowest 221 ms
  Inter latin woff2: n 999, median 60 ms, slowest 1% 103 ms, slowest 365 ms
  /assets/three-C6wp6xxT.js: n 1000, median 49 ms, slowest 1% 73 ms, slowest 50188 ms
  /assets/index-DXl3ZdsD.js: n 1000, median 44 ms, slowest 1% 65 ms, slowest 50120 ms
  /assets/react-i_nGBwMY.js: n 1000, median 38 ms, slowest 1% 58 ms, slowest 50117 ms
  /assets/index-C679l0R0.css: n 1000, median 31 ms, slowest 1% 55 ms, slowest 50113 ms
  /: n 1000, median 9 ms, slowest 1% 16 ms, slowest 327 ms
```

**合起来 2,000 次**：断连 1、卡住 3、画不出来 1，出事的打开一共 3 次。

每个本站文件的一般用时、最慢 1% 和最慢（毫秒）：

| 文件 | 次数 | 一般 | 最慢 1% | 最慢 |
|---|---:|---:|---:|---:|
| 首页 `/` | 2,000 | 9 | 18 | 327 |
| CSS | 2,000 | 31 | 55 | 50,113 |
| react | 2,000 | 38 | 59 | 50,117 |
| 主文件 | 2,000 | 44 | 65 | 50,120 |
| three | 2,000 | 49 | 72 | 50,188 |
| Inter latin | 1,999 | 60 | 104 | 10,109 |
| Cormorant latin（只有桌面加载） | 999 | 67 | 104 | 10,059 |

- 后 1,000 次的第 1 次打开断了，所以那次只有 5 个文件的计时：两个字体都没加载；前 1,000 次的 #551 没断，两个字体都有。所以 Inter 是 1,999 次，Cormorant 是 999 次。

**卡住是不是都在一个浏览器的第一次打开：是。**
- 出事的是：前 1,000 次的 #551（第 23 个浏览器），后 1,000 次的 #1 和 #526（第 1 个和第 22 个浏览器）。
- 一共 80 次第一次打开，出了 3 次；其余 1,920 次一次都没有。
- 另外：试跑时卡住的也是第一次打开；字体那一轮那次断连，是一组拍照里的第 4 次打开。

**卡住的时长是不是都接近 10 秒：都接近 10 秒的整数倍。**
- #551：四个文件 30.06–30.12 秒，后面两个字体再各 10.06、10.11 秒；
- #1：三个文件 30.10–30.18 秒，CSS 20.06 秒，主文件被断开；
- #526：四个文件 50.11–50.19 秒；
- 心跳一共失败 10 下，每下 9.76–9.93 秒，或 19.77、19.87 秒，全都在这三次出事的时候。

**每次出事前后**（UTC 时间，本地时间减 8 小时）：

- **#551**（04:44:49.980）：
  - 浏览器的 4 个连接立刻接上了；
  - 主文件在服务器上用了 20,007 毫秒；**服务器主线程被卡了 14,136 毫秒**，到 04:45:10.018 结束；
  - 之后的新连接到 04:45:10.030、20.054、20.225、30.249 才接上；
  - 心跳从 04:44:50.152、04:45:10.283、20.303 发出的三下，分别等了 19,869、9,767、9,933 毫秒后失败；
  - 这段时间 CPU 每秒 0–29%，硬盘空闲 90–100%，排队 0。
- **后 1,000 次的 #1**（05:11:23.801，服务器 05:11:23.550 才开始监听）：
  - 6 个连接立刻接上；
  - **主文件 20 毫秒就从服务器送出去了**（05:11:23.973），可是页面 30 秒后只收到 36,774 字节，连接就被断开了（`ERR_CONNECTION_RESET`，05:11:54.058）；
  - CSS、react、three 的请求分别在 05:11:34.020、44.052、54.074 才到服务器，每个隔 10 秒；
  - **服务器主线程被卡了 3,990 和 3,982 毫秒**，分别在 05:11:43.968 和 54.007 结束，正好在后两个请求到达之前；
  - 心跳两下失败，等了 19,774 和 9,795 毫秒；
  - CPU 最高 55%，硬盘至少 95% 空闲；
  - 60 秒没画出来，记录在 `test-results/blank-canvas/2026-11-07T05-12-54-655Z-resetLoop-1-desktop-canvas.json`。
- **后 1,000 次的 #526**（05:42:37.127）：
  - 页面自己的连接 05:42:37.145 接上，**另外 5 个连接到 05:42:47.198 才一起接上**；
  - 然后请求一个一个、每隔 10 秒到达服务器：CSS 05:42:57.238、主文件 05:43:07.284、react 17.282、three 27.336。每个在服务器上只用了 2–21 毫秒；
  - 心跳的新连接也是每隔 10 秒才接上（05:42:57.222、05:43:07.234、17.253、27.274），五下心跳各等了 9,761–9,775 毫秒后失败；
  - **服务器主线程没被卡**，最慢的一秒是 66.7 毫秒；
  - CPU 最高 47%，硬盘至少 89% 空闲，排队最多 1。
- **只读，不下结论**：每次出事的时候，本机上的新连接、请求和回应，都是一步一步放行的，每步约隔 10 秒。浏览器和心跳是一样的，而电脑当时并不忙。服务器的主线程三次里卡了两次，第三次没卡。

记录都在 scratchpad 的 `night/` 下面：`loop1000/`、`loop1000b/`、`combined2000.json`。网络日志留了出事那几批：前 1,000 次的 `batch-023`，后 1,000 次的 `batch-001` 和 `batch-022`。typeperf 两次都没有超过 1.6 秒的空档。

## 第 5 步：全套测试

- 22:10:37 读了电源设置：插着电，全是"从不"。
- `npm test` 从 22:10:47 跑到 23:26:21，构建 `index-DXl3ZdsD.js`。
- **164 个文件，3,497 条全过，exit 0**。vitest 自己记的用时是 4,524.67 秒，约 75 分钟。比之前多了 3 个文件、18 条，就是新加的那三个测试文件。
- 这是全套测试第一次通过新的启动脚本开服务器，记录在 `test-results/preview-server/2026-11-07T06-10-56-342Z-4174.jsonl`，10,384 行：
  - 2,359 个请求，其中开页面 347 次；
  - 一般 4 毫秒，最慢 1% 47 毫秒，最慢 116 毫秒；
  - 没有超过 5 秒的，没有被断开的，没有连接出错；
  - 主线程被卡了 37 次，每次 250–416 毫秒，没有更长的。
- 跑的过程中没有写下空白画布记录。

## 第 6 步：收尾

- 没有剩下我们的 node、esbuild、typeperf 进程或测试浏览器。只有一开始就在的 Codex 后台程序（PID 1776）。
- 4173–4177、4191、4192、4196、4197 都没有在监听。
- 系统日志从 19:41 到 23:26：19:41:32 有一对 506/507，是电脑醒来那一刻，在第 0 步之前；20:02 到 23:26 之间没有 42、506、507、107、187。
- 什么都没提交，什么都没推送。线上还是 `664b570`。

## 中途的失败

没有。每一步都是 exit 0，没有哪一步重跑。只有一处判断，是我自己做的：第 4 步"加到 2,000 次"，我理解成用同样的方式再跑 1,000 次，记录放在另一个文件夹（`loop1000b`），两次合起来算。
