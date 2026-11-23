function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function fieldRow(label, value) {
  return `<tr><th scope="row" style="padding:11px 0;text-align:left;vertical-align:top;width:120px;color:#52606a;font-size:13px;font-weight:600;border-bottom:1px solid #e8ecec;">${label}</th><td style="padding:11px 0;vertical-align:top;color:#193543;font-size:15px;font-weight:600;line-height:1.5;border-bottom:1px solid #e8ecec;">${escapeHtml(value)}</td></tr>`;
}

function preferredContactMethod(message) {
  const match = String(message || '').match(/^(?:Preferred contact method|Cách liên hệ ưu tiên|首选联系方法|偏好聯絡方式|Moyen de contact préféré|선호 연락 방법):\s*(.+)$/mi);
  return match?.[1]?.trim() || null;
}

export function buildClinicNotification(appointment, sender) {
  const preferredDate = appointment.date instanceof Date
    ? appointment.date.toISOString().slice(0, 10)
    : appointment.date;
  const message = appointment.message || 'None provided';
  const htmlMessage = escapeHtml(message).replace(/\r?\n/g, '<br>');
  const preferredContact = preferredContactMethod(message);
  const phoneLink = `tel:${String(appointment.phone).replace(/[^\d+]/g, '')}`;
  const emailLink = `mailto:${encodeURIComponent(appointment.email)}`;

  return {
    from: `"EMIS Dental" <${sender}>`,
    to: 'emisconsultation@emisdental.com',
    replyTo: appointment.email,
    subject: 'Action required: New consultation request | EMIS Dental',
    text: `NEW CONSULTATION REQUEST

PATIENT CONTACT
Name: ${appointment.name}
Phone: ${appointment.phone}
Email: ${appointment.email}
${preferredContact ? `Preferred contact: ${preferredContact}\n` : ''}
REQUEST DETAILS
Preferred date: ${preferredDate}
Service: ${appointment.service}

MESSAGE AND PREFERENCES
${message}

The preferred date is a request. Contact the patient to confirm an appointment time.`,
    html: `<html><body style="margin:0;padding:20px;background:#f3f5f3;font-family:Arial,Helvetica,sans-serif;color:#193543;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dce4e1;border-top:6px solid #b38a39;">
        <tr><td style="padding:26px 28px 22px;background:#193543;color:#ffffff;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#e3c77b;">EMIS Dental · Action required</p>
          <h1 style="margin:0 0 8px;font-size:25px;line-height:1.25;color:#ffffff;">New consultation request</h1>
          <p style="margin:0;font-size:17px;line-height:1.4;color:#ffffff;font-weight:600;">${escapeHtml(appointment.name)}</p>
        </td></tr>
        <tr><td style="padding:24px 28px;">
          <h2 style="margin:0 0 10px;font-size:16px;color:#193543;">Request details</h2>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;background:#f5f7f6;border:1px solid #e2e9e5;">
            <tr><td style="padding:14px 16px;vertical-align:top;width:50%;">
              <span style="display:block;margin-bottom:5px;color:#52606a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;">Preferred date</span>
              <strong style="color:#193543;font-size:17px;">${escapeHtml(preferredDate)}</strong>
            </td><td style="padding:14px 16px;vertical-align:top;width:50%;border-left:1px solid #e2e9e5;">
              <span style="display:block;margin-bottom:5px;color:#52606a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;">Service</span>
              <strong style="color:#193543;font-size:17px;">${escapeHtml(appointment.service)}</strong>
            </td></tr>
          </table>

          <h2 style="margin:0 0 10px;font-size:16px;color:#193543;">Patient contact</h2>
          ${preferredContact ? `<p style="margin:0 0 12px;padding:9px 12px;background:#fff5da;color:#6d501a;font-size:14px;font-weight:700;">Preferred contact: ${escapeHtml(preferredContact)}</p>` : ''}
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:16px;">
            ${fieldRow('Name', appointment.name)}
            ${fieldRow('Phone', appointment.phone)}
            ${fieldRow('Email', appointment.email)}
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:26px;"><tr>
            <td style="padding:0 8px 0 0;"><a href="${escapeHtml(phoneLink)}" style="display:inline-block;padding:12px 16px;background:#193543;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Call patient</a></td>
            <td><a href="${escapeHtml(emailLink)}" style="display:inline-block;padding:12px 16px;background:#e9f0ed;color:#193543;font-size:14px;font-weight:700;text-decoration:none;">Email patient</a></td>
          </tr></table>

          <h2 style="margin:0 0 10px;font-size:16px;color:#193543;">Message and preferences</h2>
          <div style="padding:16px;background:#f5f7f6;border-left:4px solid #b38a39;color:#193543;font-size:14px;line-height:1.7;overflow-wrap:anywhere;">${htmlMessage}</div>
          <p style="margin:20px 0 0;color:#52606a;font-size:12px;line-height:1.5;">The preferred date is a request. Contact the patient to confirm an appointment time.</p>
        </td></tr>
      </table>
    </body></html>`,
  };
}
