import "server-only";

/**
 * Sends transactional email through Resend when RESEND_API_KEY is set.
 * Without a provider, development builds log the message to the server
 * console; production refuses rather than pretending an email was sent.
 */
export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }): Promise<{ sent: boolean; devLogged?: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (key && from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      console.error("[email] provider error", res.status, await res.text().catch(() => ""));
      return { sent: false, error: "We couldn't send the email. Please try again later." };
    }
    return { sent: true };
  }
  if (process.env.NODE_ENV !== "production") {
    console.info(`\n[email:dev] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return { sent: false, devLogged: true };
  }
  return { sent: false, error: "Email delivery is not configured on this site yet. Please request a manual review instead." };
}
