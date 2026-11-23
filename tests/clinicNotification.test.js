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
  assert.match(mail.subject, /^Action required: New consultation request/);
  for (const detail of ['Test Patient', 'patient@example.com', '+84 123 456 789', '2026-12-05', 'Consultation', 'Please contact me by WhatsApp.']) {
    assert.ok(mail.text.includes(detail), `missing ${detail}`);
  }
  assert.doesNotMatch(mail.text, /undefined|netlify\.app|confirmed appointment/i);
});

test('clinic email groups fields clearly and escapes patient text in HTML', () => {
  const mail = buildClinicNotification({
    name: '<Test Patient>',
    email: 'patient@example.com',
    phone: '+84 123 456 789',
    date: new Date('2026-12-05T00:00:00.000Z'),
    service: 'Dental Implant',
    message: 'First line\n<script>alert("x")</script>',
  }, 'sender@gmail.com');

  assert.match(mail.html, /Patient contact/);
  assert.match(mail.html, /Request details/);
  assert.match(mail.html, /Message and preferences/);
  assert.match(mail.html, /Preferred date[\s\S]*2026-12-05/);
  assert.match(mail.html, /&lt;Test Patient&gt;/);
  assert.match(mail.html, /First line<br\s*\/?>(?:\s*)?&lt;script&gt;/);
  assert.doesNotMatch(mail.html, /<script>|<Test Patient>|netlify\.app/);
  assert.match(mail.text, /PATIENT CONTACT[\s\S]*REQUEST DETAILS[\s\S]*MESSAGE AND PREFERENCES/);
});

test('clinic email puts contact actions and preferred date near the top', () => {
  const mail = buildClinicNotification({
    name: 'Test Patient',
    email: 'patient@example.com',
    phone: '+84 123 456 789',
    date: new Date('2026-12-05T00:00:00.000Z'),
    service: 'Dental Implant',
    message: 'Please call me.\n\nPreferred contact method: WhatsApp',
  }, 'sender@gmail.com');

  assert.match(mail.html, /href="tel:\+84123456789"/);
  assert.match(mail.html, /href="mailto:patient%40example\.com"/);
  assert.match(mail.html, /Preferred contact[\s\S]*WhatsApp/);
  assert.ok(mail.html.indexOf('2026-12-05') < mail.html.indexOf('Message and preferences'));
  assert.ok(mail.html.indexOf('Dental Implant') < mail.html.indexOf('Message and preferences'));
});
