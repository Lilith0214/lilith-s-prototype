# 充值转账：同一渠道多个收款账户怎么区分

这是给客户用的充值/转账弹窗，不是 Fund。客户主要在欧美，界面只用英文。

原型：`recharge-transfer/index.html`。打开时默认选中 Online Payment。线下先只显示 Payoneer、Airwallex、Worldfirst、Slash、HSBC 五个渠道。点 Payoneer 或 Airwallex 后，在原位置展开成三种方式，最快的在最上面。一次只展开一家。右侧账户资料不随文案调整而改字段。

## 问题

线下转账里，Payoneer、Airwallex、Worldfirst 各有三个收款账户，左侧按钮却都只写渠道名。客户要逐个点开右侧，对照银行和户名，才能猜自己该用哪一个。

财务确认过 Payoneer 的差别：

- 前两个是美国本地银行转账，差别只是收款公司不同。
- 第三个是 Payoneer 账户，Payoneer 转给 Payoneer，到账更快。
- 每个账户还要写清：接受 ACH、SWIFT，还是两种都接受；能收哪些币种。

现网两张银行卡共用一句 “ACH: 1 business day; Swift: 1–3 business days”。HUACHAO 那张没有 SWIFT 代码，这句话会让客户以为也能走 SWIFT。

## 客户实际在选什么

欧美客户不会按「三个 Payoneer 账户」来理解。他们要回答的是：

1. 钱从自己的 Payoneer 余额出，还是从银行电汇。
2. 如果走银行，收款公司是哪一家。
3. 这条路收不收我要用的汇路和币种。

所以后缀用客户已经认识的说法，不用内部词。「同平台」在界面上写成 Payoneer to Payoneer，和现网 Friendly Reminder 里的说法一致。

## 方案

不加弹窗、抽屉，也不做悬停才出现的说明。不把一个 Payoneer 再拆成第二层选择。

币种在选转账方式之前已经选定，所以左边名称后面的后缀和提示不写币种，也不写收款公司。两个美国银行账户用银行名称区分。

展开后的三张卡，从上到下：

| 卡片标题 | 第二行 |
| --- | --- |
| Payoneer · Payoneer to Payoneer | About 10 minutes |
| Payoneer · US bank · Citibank | ACH and SWIFT |
| Payoneer · US bank · First Century Bank | ACH |

同平台标 Faster。右侧 Beneficiary name、币种和银行字段保持原样。

## 右侧

在现有资料表最上面加两行，样式和其他行一样：

| 标签 | Payoneer to Payoneer | BESTADS | HUACHAO |
| --- | --- | --- | --- |
| Accepted transfer methods | Payoneer to Payoneer | ACH, SWIFT | ACH |
| Accepted currencies | USD, EUR, GBP | USD | USD |
| Arrival time | About 10 minutes | ACH: 1 business day; SWIFT: 1–3 business days | ACH: 1 business day |

然后才是账户资料。

- Payoneer to Payoneer：Payoneer Account `bestads01@163.com`，Beneficiary name `BESTADS LIMITED`。不出现银行字段。水单提示写成提交 Payoneer receipt。
- BESTADS：Citibank，111 Wall Street New York, NY 10043 USA，Routing (ABA) `031100209`，SWIFT `CITIUS33`，Account number `70585200002228282`，CHECKING。
- HUACHAO：First Century Bank，1731 N Elm St Commerce, GA 30529 USA，Routing (ABA) `061120084`，Account number `4023713418887`，CHECKING。没有 SWIFT 行，Arrival time 里也不写 SWIFT。

没有 SWIFT 的账户，到账文案不要再写 Swift。

## 其他渠道

点 Airwallex 后同样在原位置展开三张，按到账快慢排列，左侧不写公司和币种：

1. Airwallex to Airwallex，About 1 hour。
2. US bank · Community Federal Savings Bank，ACH & Wire, SWIFT。
3. Hong Kong bank · DBS Bank (Hong Kong) Limited，Local and SWIFT。

右侧沿用现有字段和原文，包括户名、账号、路由号和 Notes。Friendly Reminder 不改。

Worldfirst、Slash、HSBC 仍是单张渠道。Worldfirst 还没有真实账号，点开后仍是 Example，不写假账号。

Slash、HSBC 各只有一个账户，排在多账户渠道后面，名称后面不加后缀。

PayPal 仍在 Online Payment 里，不加这套后缀。

币种切换后隐藏不匹配的账户，这次原型不做。产品上仍建议：美国银行账户只在付款币种为 USD 时出现。

## 请财务确认

1. BESTADS（Citibank）有 SWIFT 代码 CITIUS33，HUACHAO 没有。原型按「BESTADS 接受 ACH 和 SWIFT，HUACHAO 只接受 ACH」展示。若两张都只接受美国本地 ACH，BESTADS 的 SWIFT 会去掉，两张卡只靠收款公司区分。
2. 币种是不是「Payoneer to Payoneer 收 USD/EUR/GBP，美国银行只收 USD」。
3. Worldfirst 的三个账户、汇路和账号还没有。补齐前右侧继续标 Example，不写假账号。
4. 如果系统已经知道客户的签约主体，后续可以默认选中对应的银行账户。公司名只留在右侧账户资料里。

## 验收

- 打开时默认 Online Payment，线下只看到五个渠道。
- 点 Payoneer 或 Airwallex，在原位置展开三张，最快的在最上面。左侧能看出同平台还是哪家银行，以及汇路，不出现公司和币种。
- 点其中一个，右侧账户资料跟着变，字段和原文不改。Friendly Reminder 不改。
- 没有第二层弹窗。
