import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClinicNotification } from '../clinicNotification.js';

test('clinic email contains the request details and goes to the Zoho inbox', () => {
  const mail = buildClinicNotification({
    name: 'Test Patient',
    email: 'patient@example.com',
    phone: '+84 123 456 789',
    date: new Date('2026-12-05T00:00:00.000Z'),
    service: 'Consultation',
    message: 'Please contact me by WhatsApp.',
  }, 'sender@gmail.com');

  assert.equal(mail.to, 'emisconsultation@emisdental.com');
  assert.match(mail.from, /sender@gmail\.com/);
  assert.equal(mail.replyTo, 'patient@example.com');
  assert.match(mail.subject, /request/i);
  for (const detail of ['Test Patient', 'patient@example.com', '+84 123 456 789', '2026-12-05', 'Consultation', 'Please contact me by WhatsApp.']) {
    assert.ok(mail.text.includes(detail), `missing ${detail}`);
  }
  assert.doesNotMatch(mail.text, /undefined|netlify\.app|confirmed appointment/i);
});
