# Bheem Workspace - Updates

## December 2024 - Notify Service Integration

### Overview
Integrated Bheem Workspace with the centralized Bheem Notify service for all communications (SMS, Email, Voice, OTP, WhatsApp).

### Changes Made

#### New Files
- `backend/services/notify_client.py` - Unified NotifyClient SDK

#### Modified Files
- `backend/api/mail.py` - Updated to use NotifyClient instead of direct MSG91 calls

### NotifyClient Features
- Email sending (single, bulk, template-based)
- SMS sending (single, bulk)
- OTP send/verify/resend
- Voice calls
- WhatsApp messaging (template and text)
- Unified notification API

### Backward Compatibility
The NotifyClient exports backward-compatible aliases:
```python
from services.notify_client import msg91_service  # Works with existing code
from services.notify_client import notify_client  # New preferred import
```

### Configuration
No configuration changes required. The NotifyClient connects to:
- Internal: `http://bheem-notify:8005/api/v1` (Docker)
- External: `http://bheem.co.uk:8005/api/v1`

### API Endpoints Affected
All `/api/v1/mail/bheem-tele/*` endpoints now route through centralized Notify service:
- POST `/bheem-tele/send` - Send email
- POST `/bheem-tele/template` - Send template email
- POST `/bheem-tele/otp` - Send OTP email
- POST `/bheem-tele/welcome` - Send welcome email
- POST `/bheem-tele/meeting-invite` - Send meeting invite
- POST `/bheem-tele/sms/send` - Send SMS
- POST `/bheem-tele/sms/otp` - Send OTP SMS
- POST `/bheem-tele/sms/verify` - Verify OTP

### Benefits
1. Centralized logging and analytics
2. Unified rate limiting
3. Consistent retry policies
4. Easy provider switching at platform level
5. Reduced code duplication (~60KB across modules)

### Testing
Run the test script:
```bash
cd backend
python test_notify_client.py
```

---
*Updated: December 24, 2024*
