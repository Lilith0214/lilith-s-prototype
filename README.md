# lilith-s-prototype

静态 HTML 原型，用浏览器打开即可，不用安装依赖，也不用构建。

## 垫资期初余额

页面在 `advance-balance/index.html`。左侧可以在 Fund 和垫资对账系统之间切换。

直接打开：

```bash
# macOS
open advance-balance/index.html

# Windows
start advance-balance/index.html
```

也可以把文件拖进浏览器。用本地服务时：

```bash
node server.js
```

浏览器访问 <http://127.0.0.1:43123/advance-balance/> 。

建议按这个顺序点一遍：

1. Fund → 商户管理。子业务里有垫资，广告、履约、拒付还在。筛「垫资」可以只看垫资账户。
2. Fund → 账户调拨列表 → 新增资金调拨。调出选 CUISAMIX 垫资，调入选 CUISAMIX 履约，金额填 200，提交审核。新行状态是「待飞书审批」。这时商户余额、交易详情、余额表都不变。
3. 在该行点「审批通过」。
4. Fund → 交易详情。最上面多一条流水。
5. 对账 → 余额表。CUISAMIX 这一周期的期末和 Fund同步余额改成审批后的垫资余额。

手动调额在账户调拨列表，也是提交后待飞书审批，通过后才改余额并同步期末。保证金释放不在这个弹窗里。

余额表的两行示例来自两份周对账单，扣款项按对账单记为负数：

- CUISAMIX，2026-10-13 至 2026-10-20，paypal。本期结算额 1,431.69 EUR。
- Bellora Beauty Milano，2026-06-24 至 2026-06-30，oceanpayment（对账单里写 OP）。本期结算额 5.55 EUR。

对账单没有期初，原型按 0.00。折算过程写在余额表页面下方。

平台收款明细有 paypal、airwallex、oceanpayment、shopifypayments 四个 Tab，列先用现有 PayPal 列，并注明数据从 Fund 同步，不提供导入 Excel。

## 仓库里的其他原型

- `index.html`：金额调整
- `approval-center/`：审批中心
- `feishu-claim/`：飞书认领
- `claim-dialog/`：认领弹窗静态资源
