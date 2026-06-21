import nodemailer from "nodemailer";

const BRAND = "HERSTYLE";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: BRAND, email: from.trim() };
}

function getDefaultSender(): { name: string; email: string } {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const from =
    process.env.EMAIL_FROM?.trim() ||
    (adminEmail ? `${BRAND} <${adminEmail}>` : `${BRAND} <noreply@herstyle.com>`);
  return parseSender(from);
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT) || 587;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim() || getTransporter());
}

async function sendViaBrevo(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ sent: boolean; dev: boolean } | null> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) return null;

  const sender = getDefaultSender();
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: sender.name, email: sender.email },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Brevo failed (${res.status}): ${errBody}`);
  }

  return { sent: true, dev: false };
}

async function sendMail(to: string, subject: string, html: string, text: string) {
  try {
    const brevoResult = await sendViaBrevo(to, subject, html, text);
    if (brevoResult) return brevoResult;
  } catch (err) {
    console.error("[email:brevo]", err instanceof Error ? err.message : err);
    throw err;
  }

  const transporter = getTransporter();
  const sender = getDefaultSender();
  const from = `"${sender.name}" <${sender.email}>`;

  if (!transporter) {
    console.log(`[email:dev] To: ${to}\nSubject: ${subject}\n${text}\n---`);
    return { sent: false, dev: true };
  }

  await transporter.sendMail({ from, to, subject, html, text });
  return { sent: true, dev: false };
}

function emailLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f5f2;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f2;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.06);">
        <tr><td style="background:#111;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:#c9a96e;font-size:28px;letter-spacing:0.15em;font-weight:400;">${BRAND}</h1>
          <p style="margin:8px 0 0;color:#aaa;font-size:13px;font-family:Arial,sans-serif;">Premium Women's Fashion</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 20px;font-size:22px;color:#111;font-weight:400;">${title}</h2>
          ${body}
        </td></tr>
        <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;text-align:center;">
          <p style="margin:0;font-size:12px;color:#999;font-family:Arial,sans-serif;">
            © ${new Date().getFullYear()} ${BRAND} · <a href="${APP_URL}" style="color:#c9a96e;">Visit store</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  const subject = "Reset your HERSTYLE password";
  const text = `Hi ${name},\n\nReset your password: ${resetUrl}\n\nLink expires in 1 hour.\n\n— HERSTYLE`;

  const html = emailLayout(
    "Reset your password",
    `<p style="font-family:Arial,sans-serif;color:#555;line-height:1.7;">Hi ${name},</p>
     <p style="font-family:Arial,sans-serif;color:#555;line-height:1.7;">We received a request to reset your password. Click the button below — link expires in <strong>1 hour</strong>.</p>
     <p style="text-align:center;margin:28px 0;">
       <a href="${resetUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-family:Arial,sans-serif;font-size:14px;">Reset Password</a>
     </p>
     <p style="font-family:Arial,sans-serif;color:#888;font-size:13px;word-break:break-all;">Or copy: ${resetUrl}</p>
     <p style="font-family:Arial,sans-serif;color:#888;font-size:13px;">If you didn't request this, ignore this email.</p>`
  );

  return sendMail(to, subject, html, text);
}

export interface ReceiptItem {
  name: string;
  size?: string;
  quantity: number;
  price: number;
}

export async function sendOrderReceiptEmail(
  to: string,
  name: string,
  order: {
    orderId: string;
    subtotal?: number;
    discount?: number;
    couponCode?: string;
    total: number;
    totalUsd?: number;
    items: ReceiptItem[];
    shipping: { fullname: string; address: string; city: string; pincode: string; phone: string };
    paidAt: Date;
  }
) {
  const orderRef = order.orderId.slice(-6).toUpperCase();
  const subject = `Order confirmed — HERSTYLE #${orderRef}`;

  const itemRows = order.items
    .map(
      (i) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #eee;font-family:Arial,sans-serif;color:#333;font-size:14px;">
          ${i.name}${i.size ? ` <span style="color:#888;">· Size ${i.size}</span>` : ""}
        </td>
        <td style="padding:12px 8px;border-bottom:1px solid #eee;text-align:center;font-family:Arial,sans-serif;color:#666;font-size:14px;">${i.quantity}</td>
        <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;font-family:Arial,sans-serif;color:#111;font-size:14px;">₹${(i.price * i.quantity).toLocaleString("en-IN")}</td>
      </tr>`
    )
    .join("");

  const usdLine = order.totalUsd
    ? `<p style="font-family:Arial,sans-serif;color:#666;font-size:14px;margin:4px 0 0;">Paid: <strong>$${order.totalUsd.toFixed(2)} USD</strong> via Stripe</p>`
    : "";

  const discountLine =
    order.discount && order.discount > 0
      ? `<p style="text-align:right;font-family:Arial,sans-serif;font-size:14px;color:#2e7d32;margin:0 0 4px;">${order.couponCode || "Discount"}: -₹${order.discount.toLocaleString("en-IN")}</p>`
      : "";

  const text = `Hi ${name},\n\nOrder #${orderRef} confirmed.\nTotal: ₹${order.total.toLocaleString("en-IN")}\n\nThank you for shopping with HERSTYLE!`;

  const html = emailLayout(
    "Your order is confirmed!",
    `<p style="font-family:Arial,sans-serif;color:#555;line-height:1.7;">Hi ${name}, thank you for shopping with us. Here's your receipt.</p>
     <div style="background:#fafafa;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #eee;">
       <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Order #${orderRef}</p>
       <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#888;">${order.paidAt.toLocaleString("en-IN")}</p>
     </div>
     <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
       <tr style="border-bottom:2px solid #111;">
         <th align="left" style="padding:8px 0;font-family:Arial,sans-serif;font-size:12px;color:#888;text-transform:uppercase;">Item</th>
         <th style="padding:8px;font-family:Arial,sans-serif;font-size:12px;color:#888;text-transform:uppercase;">Qty</th>
         <th align="right" style="padding:8px 0;font-family:Arial,sans-serif;font-size:12px;color:#888;text-transform:uppercase;">Amount</th>
       </tr>
       ${itemRows}
     </table>
     ${discountLine}
     <p style="text-align:right;font-family:Arial,sans-serif;font-size:20px;color:#111;margin:0 0 4px;"><strong>₹${order.total.toLocaleString("en-IN")}</strong></p>
     ${usdLine}
     <div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee;">
       <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Shipping to</p>
       <p style="margin:0;font-family:Arial,sans-serif;color:#333;line-height:1.6;">
         ${order.shipping.fullname}<br>
         ${order.shipping.address}<br>
         ${order.shipping.city} ${order.shipping.pincode}<br>
         ${order.shipping.phone}
       </p>
     </div>
     <p style="text-align:center;margin:28px 0 0;">
       <a href="${APP_URL}/orders" style="display:inline-block;background:#c9a96e;color:#111;text-decoration:none;padding:14px 32px;border-radius:50px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;">View My Orders</a>
     </p>`
  );

  return sendMail(to, subject, html, text);
}

export async function sendOrderShippedEmail(
  to: string,
  name: string,
  order: {
    orderId: string;
    trackingId: string;
    trackingCarrier?: string;
    shipping: { fullname: string; city: string };
  }
) {
  const orderRef = order.orderId.slice(-6).toUpperCase();
  const carrier = order.trackingCarrier || "Courier";
  const subject = `Your order #${orderRef} has shipped!`;
  const trackUrl = `${APP_URL}/orders`;

  const text = `Hi ${name},\n\nOrder #${orderRef} has shipped!\n${carrier} tracking: ${order.trackingId}\n\n— HERSTYLE`;

  const html = emailLayout(
    "Your order is on the way!",
    `<p style="font-family:Arial,sans-serif;color:#555;line-height:1.7;">Hi ${name}, great news — your HERSTYLE order is on its way to ${order.shipping.city}.</p>
     <div style="background:#fafafa;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #eee;">
       <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;color:#888;text-transform:uppercase;">Order #${orderRef}</p>
       <p style="margin:8px 0 0;font-family:Arial,sans-serif;color:#111;"><strong>${carrier}</strong></p>
       <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:18px;color:#c9a96e;font-weight:600;">${order.trackingId}</p>
     </div>
     <p style="text-align:center;margin:28px 0 0;">
       <a href="${trackUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-family:Arial,sans-serif;font-size:14px;">Track Order</a>
     </p>`
  );

  return sendMail(to, subject, html, text);
}

export async function sendOrderDeliveredEmail(
  to: string,
  name: string,
  order: {
    orderId: string;
    deliveredAt: Date;
    total: number;
    discount?: number;
    couponCode?: string;
    items: ReceiptItem[];
    shipping: { fullname: string; address: string; city: string; pincode: string; phone: string };
  }
) {
  const orderRef = order.orderId.slice(-6).toUpperCase();
  const subject = `Delivered — HERSTYLE order #${orderRef}`;

  const itemSummary = order.items
    .slice(0, 3)
    .map((i) => `${i.name}${i.size ? ` (${i.size})` : ""} × ${i.quantity}`)
    .join(", ");
  const moreItems = order.items.length > 3 ? ` + ${order.items.length - 3} more` : "";

  const discountLine =
    order.discount && order.discount > 0
      ? `<p style="font-family:Arial,sans-serif;font-size:14px;color:#2e7d32;margin:8px 0 0;">${order.couponCode || "Discount"}: -₹${order.discount.toLocaleString("en-IN")}</p>`
      : "";

  const text = `Hi ${name},\n\nYour HERSTYLE order #${orderRef} has been delivered!\nTotal: ₹${order.total.toLocaleString("en-IN")}\n\nWe hope you love your purchase!\n\n— HERSTYLE`;

  const html = emailLayout(
    "Your order has been delivered!",
    `<p style="font-family:Arial,sans-serif;color:#555;line-height:1.7;">Hi ${name}, great news — your HERSTYLE order has arrived. We hope you love everything you picked!</p>
     <div style="background:#f3faf4;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #c8e6c9;">
       <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;color:#2e7d32;text-transform:uppercase;letter-spacing:0.08em;">Delivered · Order #${orderRef}</p>
       <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#666;">${order.deliveredAt.toLocaleString("en-IN")}</p>
       <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:14px;color:#333;">${itemSummary}${moreItems}</p>
       <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:18px;color:#111;"><strong>₹${order.total.toLocaleString("en-IN")}</strong></p>
       ${discountLine}
     </div>
     <div style="margin-top:8px;padding-top:16px;border-top:1px solid #eee;">
       <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Delivered to</p>
       <p style="margin:0;font-family:Arial,sans-serif;color:#333;line-height:1.6;">
         ${order.shipping.fullname}<br>
         ${order.shipping.address}<br>
         ${order.shipping.city} ${order.shipping.pincode}
       </p>
     </div>
     <p style="text-align:center;margin:28px 0 0;">
       <a href="${APP_URL}/orders" style="display:inline-block;background:#c9a96e;color:#111;text-decoration:none;padding:14px 32px;border-radius:50px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;">View Order</a>
     </p>
     <p style="font-family:Arial,sans-serif;color:#888;font-size:13px;text-align:center;margin-top:16px;">Questions? Reply to this email or visit your orders page.</p>`
  );

  return sendMail(to, subject, html, text);
}

export interface AbandonedCartItem {
  name: string;
  slug: string;
  image: string;
  price: number;
  quantity: number;
  size: string;
}

export async function sendAbandonedCartEmail(
  to: string,
  name: string,
  cart: { items: AbandonedCartItem[]; total: number }
) {
  const subject = "You left something in your cart — HERSTYLE";
  const cartUrl = `${APP_URL}/cart`;

  const itemRows = cart.items
    .slice(0, 4)
    .map(
      (i) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #eee;font-family:Arial,sans-serif;color:#333;font-size:14px;">
          ${i.name}${i.size ? ` <span style="color:#888;">· Size ${i.size}</span>` : ""}
        </td>
        <td style="padding:12px 8px;border-bottom:1px solid #eee;text-align:center;font-family:Arial,sans-serif;color:#666;font-size:14px;">${i.quantity}</td>
        <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;font-family:Arial,sans-serif;color:#111;font-size:14px;">₹${(i.price * i.quantity).toLocaleString("en-IN")}</td>
      </tr>`
    )
    .join("");

  const text = `Hi ${name},\n\nYou still have items waiting in your cart (₹${cart.total.toLocaleString("en-IN")}).\nComplete checkout: ${cartUrl}\n\n— HERSTYLE`;

  const html = emailLayout(
    "Your cart is waiting",
    `<p style="font-family:Arial,sans-serif;color:#555;line-height:1.7;">Hi ${name}, you left some beautiful picks in your cart. They're still reserved for you — complete checkout before they're gone.</p>
     <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
       <tr>
         <th align="left" style="padding:8px 0;font-family:Arial,sans-serif;font-size:12px;color:#888;text-transform:uppercase;">Item</th>
         <th style="padding:8px;font-family:Arial,sans-serif;font-size:12px;color:#888;text-transform:uppercase;">Qty</th>
         <th align="right" style="padding:8px 0;font-family:Arial,sans-serif;font-size:12px;color:#888;text-transform:uppercase;">Amount</th>
       </tr>
       ${itemRows}
     </table>
     <p style="text-align:right;font-family:Arial,sans-serif;font-size:20px;color:#111;margin:0 0 4px;"><strong>₹${cart.total.toLocaleString("en-IN")}</strong></p>
     <p style="text-align:center;margin:28px 0 0;">
       <a href="${cartUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;">Return to Cart</a>
     </p>
     <p style="font-family:Arial,sans-serif;color:#888;font-size:13px;text-align:center;margin-top:16px;">Need help choosing? Chat with Style Muse on our site.</p>`
  );

  return sendMail(to, subject, html, text);
}
