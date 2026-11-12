# 充值转账：同一渠道多个收款账户怎么区分

这是给客户用的充值/转账弹窗，不是 Fund。客户主要在欧美，界面只用英文。

原型：`recharge-transfer/index.html`。左侧列出全部转账账户，并按渠道排序：同平台放在该渠道第一位。点 Payoneer 时，右侧换成截图里的真实收款账户。没有中文界面，没有二级弹窗。

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

左侧仍是支付方式卡片，名称后面加后缀，第二行写时效、汇路和币种。同平台放在第一个，并标 Faster。点卡片只刷新右侧账户资料。

三个选项一行一个，用单选圆点。这是欧美结账页的习惯，比两个一行的小按钮更容易扫完。

| 卡片标题 | 第二行 |
| --- | --- |
| Payoneer · Payoneer to Payoneer | About 10 minutes · USD, EUR, GBP |
| Payoneer · US bank · BESTADS | ACH and SWIFT · USD only |
| Payoneer · US bank · HUACHAO | ACH · USD only |

BESTADS、HUACHAO 加粗。卡片用收款公司简称，右侧 Beneficiary name 用全称。简称人工配置，不要从全称自动截断。

标题下有一句说明，直接放在列表上：

“Payoneer to Payoneer arrives faster. The two US bank options differ only by the beneficiary company. If you are not sure which company to pay, check with your account manager before you send the money.”

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

列表里同时展示 Airwallex、Worldfirst、Slash、HSBC，并参与排序。Airwallex 和 Worldfirst 各三张：同平台在前，两张美国银行在后，标 Example。这两家还没有真实收款公司和账号，右侧只显示转账方式、币种和到账时间，不写假账号。财务补齐后去掉 Example，按 Payoneer 的规则展示完整资料。

Slash、HSBC 各只有一个账户，排在多账户渠道后面，名称后面不加后缀。

PayPal 仍在 Online Payment 里，不加这套后缀。

币种切换后隐藏不匹配的账户，这次原型不做。产品上仍建议：美国银行账户只在付款币种为 USD 时出现。

## 请财务确认

1. BESTADS（Citibank）有 SWIFT 代码 CITIUS33，HUACHAO 没有。原型按「BESTADS 接受 ACH 和 SWIFT，HUACHAO 只接受 ACH」展示。若两张都只接受美国本地 ACH，BESTADS 的 SWIFT 会去掉，两张卡只靠收款公司区分。
2. 币种是不是「Payoneer to Payoneer 收 USD/EUR/GBP，美国银行只收 USD」。
3. Airwallex、Worldfirst 是不是同样的「两张美国银行 + 一张同平台」，以及各自的收款公司简称、汇路、币种和账号。
4. 如果系统已经知道客户的签约主体，后续可以默认选中对应的银行账户。这次没有这个数据，所以只把公司简称写在名称后面。

## 验收

- 界面是英文，读起来是在选付款方式，不是在选三个同名 Payoneer。
- 不点开右侧，也能看出三个选项分别是 Payoneer to Payoneer、BESTADS、HUACHAO，以及汇路和币种。
- 点其中一个，右侧账户资料跟着变。HUACHAO 不出现 SWIFT。
- 没有第二层弹窗。
