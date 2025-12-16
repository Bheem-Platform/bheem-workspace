# bheem.co.uk DNS Records for Email

**Domain:** bheem.co.uk
**Mail Server:** mail.bheem.cloud (135.181.25.62)
**Generated:** December 9, 2025

---

## Required DNS Records

Add these records to your domain registrar (e.g., Cloudflare, GoDaddy, Namecheap):

### 1. MX Record (Mail Exchange)
```
Type: MX
Host: @
Value: mail.bheem.cloud
Priority: 10
TTL: 3600
```

### 2. SPF Record (Sender Policy Framework)
```
Type: TXT
Host: @
Value: v=spf1 mx a include:mail.bheem.cloud ~all
TTL: 3600
```

### 3. DKIM Record (DomainKeys Identified Mail)
```
Type: TXT
Host: dkim._domainkey
Value: v=DKIM1;k=rsa;t=s;s=email;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtRvr9d6h5ZuWRv279H5CXiPZ20jPEa0oMFl8CCj0ZJ8sf2ne+HOT+lK8jM2yOkd6umfTCJ0IwP+EdhiUSRHOP06L/92u7woEh1ezP+9OAXOeB9RLJVDRD5tzDNubzsl9wVNauP+wGkXzK5gXF1uo6RQbC1qlqdRpFNI4zGnppI8k0NldCMSYTg24WdgJp6sTuO1+RpGUq0f7BF6mHj4vV4T4+fYdfJfRbeuJSMi/KBHtzg+4r5BhV0RjWEl0TlBv+zaozpcmMf1T0dyZi4k6KBIV84Divu3OlY/3irkg7kFDpsDMUVyEGlSnINsbb29mmvPnw2P4JidwfpGDwPUdnwIDAQAB
TTL: 3600
```

### 4. DMARC Record
```
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:admin@bheem.co.uk; fo=1
TTL: 3600
```

### 5. Autodiscover (for Outlook/Mobile)
```
Type: CNAME
Host: autodiscover
Value: mail.bheem.cloud
TTL: 3600

Type: CNAME
Host: autoconfig
Value: mail.bheem.cloud
TTL: 3600
```

### 6. SRV Records (Optional - for advanced clients)
```
Type: SRV
Host: _submission._tcp
Value: 0 1 587 mail.bheem.cloud
TTL: 3600

Type: SRV
Host: _imaps._tcp
Value: 0 1 993 mail.bheem.cloud
TTL: 3600

Type: SRV
Host: _pop3s._tcp
Value: 0 1 995 mail.bheem.cloud
TTL: 3600
```

---

## Created Mailboxes

| Email | Name | Password | Quota |
|-------|------|----------|-------|
| sundeep@bheem.co.uk | Sundeep - Director | BheemVerse2024 | 10GB |
| admin@bheem.co.uk | Admin | BheemAdmin2024 | 5GB |
| info@bheem.co.uk | Info | BheemInfo2024 | 5GB |
| support@bheem.co.uk | Support | BheemSupport2024 | 5GB |

**IMPORTANT:** Change these passwords after first login!

---

## Access URLs

| Service | URL |
|---------|-----|
| Webmail (SOGo) | https://mail.bheem.cloud/SOGo |
| Admin Panel | https://mail.bheem.cloud |

---

## Email Client Settings

### IMAP (Incoming)
```
Server: mail.bheem.cloud
Port: 993
Security: SSL/TLS
Username: full email address (e.g., sundeep@bheem.co.uk)
```

### SMTP (Outgoing)
```
Server: mail.bheem.cloud
Port: 465 (SSL) or 587 (STARTTLS)
Security: SSL/TLS or STARTTLS
Username: full email address
Authentication: Required
```

---

## Verification Commands

After adding DNS records, verify with:

```bash
# Check MX record
dig MX bheem.co.uk

# Check SPF
dig TXT bheem.co.uk

# Check DKIM
dig TXT dkim._domainkey.bheem.co.uk

# Check DMARC
dig TXT _dmarc.bheem.co.uk

# Test email deliverability
# Send test email to: check-auth@verifier.port25.com
```

---

## Next Steps

1. Add DNS records to bheem.co.uk domain registrar
2. Wait for DNS propagation (up to 24-48 hours)
3. Test email sending/receiving
4. Change default passwords
5. Set up email aliases if needed
6. Configure email signatures
