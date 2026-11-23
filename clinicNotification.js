export function buildClinicNotification(appointment, sender) {
  const preferredDate = appointment.date instanceof Date
    ? appointment.date.toISOString().slice(0, 10)
    : appointment.date;

  return {
    from: `"EMIS Dental" <${sender}>`,
    to: 'emisconsultation@emisdental.com',
    replyTo: appointment.email,
    subject: 'New appointment request | EMIS Dental',
    text: `A patient submitted an appointment request through the EMIS Dental website.

Name: ${appointment.name}
Email: ${appointment.email}
Phone: ${appointment.phone}
Preferred date: ${preferredDate}
Service: ${appointment.service}
Message and preferences: ${appointment.message || 'None provided'}

The clinic should contact the patient to confirm an appointment time.`,
  };
}
