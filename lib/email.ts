import nodemailer from 'nodemailer'

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendResetEmail(to: string, name: string, resetLink: string) {
  if (!process.env.SMTP_USER) {
    // Sem SMTP configurado: imprime no console para desenvolvimento
    console.log('\n🔑 RESET LINK (dev mode — configure SMTP_USER/SMTP_PASS no .env.local):')
    console.log(`   Para: ${to}`)
    console.log(`   Link: ${resetLink}\n`)
    return
  }

  const transporter = createTransporter()
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Bolão Copa 2026 — Recuperação de Senha',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#16a34a">Bolão Copa do Mundo 2026</h2>
        <p>Olá <strong>${name}</strong>,</p>
        <p>Você solicitou a redefinição da sua senha. Clique no botão abaixo para criar uma nova senha:</p>
        <p style="text-align:center;margin:32px 0">
          <a href="${resetLink}"
             style="background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
            Redefinir senha
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px">
          Este link expira em 1 hora.<br>
          Se você não solicitou isso, ignore este email.
        </p>
      </div>
    `,
  })
}
