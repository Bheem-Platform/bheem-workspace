# Bheem Workspace - Email Templates

Transactional email templates for ZeptoMail integration.

## Templates

| # | Template | File | Variables |
|---|----------|------|-----------|
| 1 | OTP Verification | `01-otp-verification.html` | `{{OTP}}` |
| 2 | Welcome Email | `02-welcome-email.html` | `{{NAME}}` |
| 3 | Password Reset | `03-password-reset.html` | `{{NAME}}`, `{{RESET_LINK}}` |
| 4 | Meeting Invitation | `04-meeting-invitation.html` | `{{HOST_NAME}}`, `{{MEETING_NAME}}`, `{{DATE_TIME}}`, `{{MEETING_URL}}` |
| 5 | Document Shared | `05-document-shared.html` | `{{SHARED_BY}}`, `{{DOCUMENT_NAME}}`, `{{PERMISSION_LEVEL}}`, `{{MESSAGE}}`, `{{DOCUMENT_URL}}` |
| 6 | Team Invitation | `06-team-invitation.html` | `{{INVITER_NAME}}`, `{{TEAM_NAME}}`, `{{TEAM_INITIAL}}`, `{{MEMBER_COUNT}}`, `{{INVITE_LINK}}` |
| 7 | Login Alert | `07-login-alert.html` | `{{NAME}}`, `{{LOGIN_TIME}}`, `{{DEVICE}}`, `{{BROWSER}}`, `{{LOCATION}}`, `{{IP_ADDRESS}}`, `{{SECURE_ACCOUNT_URL}}` |
| 8 | Payment Receipt | `08-payment-receipt.html` | `{{NAME}}`, `{{RECEIPT_NUMBER}}`, `{{DATE}}`, `{{PLAN_NAME}}`, `{{BILLING_PERIOD}}`, `{{PAYMENT_METHOD}}`, `{{AMOUNT}}`, `{{INVOICE_URL}}` |

## Usage

These templates are designed for transactional emails sent via ZeptoMail API.

### Sender Addresses
- `noreply@bheem.co.uk` - System notifications
- `notifications@bheem.co.uk` - User notifications
- `billing@bheem.cloud` - Payment related

## Preview

Open any `.html` file in a browser to preview the template design.

## Brand Colors

- Primary Blue: `#2563eb`
- Primary Purple: `#7c3aed`
- Success Green: `#10b981`
- Warning Yellow: `#f59e0b`
- Error Red: `#ef4444`
- Text Dark: `#1e293b`
- Text Light: `#64748b`
- Background: `#f5f7fa`
