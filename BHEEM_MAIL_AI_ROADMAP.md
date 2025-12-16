# Bheem Mail AI Roadmap

## Vision
Transform Bheem Mail into an AI-powered email platform that rivals Gmail and Outlook 365, with intelligent features powered by AgentBheem CLI.

---

## Current State

### Existing Features (bheem-mail.html)
- [x] Modern webmail UI
- [x] SSO with Bheem Core authentication
- [x] IMAP email fetching via backend API
- [x] SMTP email sending
- [x] Folder navigation (Inbox, Sent, Drafts, Trash, Spam)
- [x] Email compose modal
- [x] Reply functionality
- [x] Search (client-side)
- [x] Auto-refresh (30 seconds)
- [x] Starred emails
- [x] Labels (Work, Personal, Finance, Travel)
- [x] Attachments display
- [x] Responsive design

### Backend API (api/mail.py)
- [x] GET /mail/folders - List folders
- [x] GET /mail/messages - List messages
- [x] GET /mail/messages/{id} - Get message
- [x] POST /mail/send - Send email
- [x] DELETE /mail/messages/{id} - Delete message

---

## Phase 1: AI Foundation (Week 1-2)

### 1.1 AgentBheem Email Agent Integration
- [ ] Import EmailAgent from AgentBheem CLI
- [ ] Create `/api/v1/mail/ai/*` endpoints
- [ ] Set up model routing (Claude, GPT-4, DeepSeek)

### 1.2 AI Compose Assistant
- [ ] POST `/mail/ai/compose` - Generate email from prompt
  - Input: `{ prompt: "Write an email to client about project delay", tone: "professional" }`
  - Output: `{ subject: "...", body: "..." }`
- [ ] POST `/mail/ai/rewrite` - Rewrite email with different tone
  - Tones: Professional, Friendly, Formal, Casual, Urgent
- [ ] POST `/mail/ai/complete` - Autocomplete email text

### 1.3 Smart Reply
- [ ] POST `/mail/ai/replies` - Generate reply suggestions
  - Input: `{ email_id: "...", context: "original email content" }`
  - Output: `{ replies: ["Thanks, I'll review this.", "Sounds good!", "Let me check and get back to you."] }`

---

## Phase 2: Email Intelligence (Week 3-4)

### 2.1 Email Summarization
- [ ] POST `/mail/ai/summarize` - Summarize single email
- [ ] POST `/mail/ai/summarize-thread` - Summarize email thread
- [ ] POST `/mail/ai/extract-actions` - Extract action items
  - Output: `{ actions: ["Review proposal by Friday", "Schedule call with John"] }`

### 2.2 Priority Inbox (AI Categorization)
- [ ] POST `/mail/ai/categorize` - Categorize email importance
  - Categories: Important, Normal, Low Priority, Spam
- [ ] Auto-categorize on email arrival
- [ ] Train model on user interactions (starred, replied, ignored)

### 2.3 Smart Search
- [ ] POST `/mail/ai/search` - Semantic email search
  - Input: `{ query: "emails about the marketing budget from last month" }`
  - Uses vector embeddings for semantic matching

---

## Phase 3: Advanced AI Features (Week 5-6)

### 3.1 Email Agent (Autonomous)
- [ ] Create BheemMailAgent in AgentBheem CLI
- [ ] Tools:
  - `read_emails(folder, count)` - Read recent emails
  - `search_emails(query)` - Search emails
  - `compose_email(to, subject, body)` - Compose email
  - `send_email(draft_id)` - Send email
  - `reply_to_email(email_id, body)` - Reply to email
  - `forward_email(email_id, to)` - Forward email
  - `create_label(name)` - Create label
  - `apply_label(email_id, label)` - Apply label
  - `schedule_email(draft_id, datetime)` - Schedule send

### 3.2 Inbox Zero Automation
- [ ] Auto-archive read emails older than X days
- [ ] Bulk unsubscribe from newsletters
- [ ] Auto-label based on sender/content
- [ ] Follow-up reminders for unanswered emails

### 3.3 Email Templates
- [ ] AI-generated templates based on use case
- [ ] Template library with categories
- [ ] Personalization with merge fields

---

## Phase 4: Frontend AI Integration (Week 7-8)

### 4.1 AI Sidebar in Webmail
```
+------------------+----------------------------------+-------------+
|                  |                                  |             |
|    Folders       |         Email View               |  AI Panel   |
|                  |                                  |             |
|  - Inbox         |  Subject: Project Update         |  [Summarize]|
|  - Sent          |  From: john@example.com          |  [Reply]    |
|  - Drafts        |                                  |  [Actions]  |
|                  |  Hi team,                        |             |
|                  |  Here's the latest update...     |  =========  |
|                  |                                  |  Summary:   |
|                  |                                  |  - Budget   |
|                  |                                  |  - Timeline |
|                  |                                  |  - Tasks    |
+------------------+----------------------------------+-------------+
```

### 4.2 Compose with AI
- [ ] "Write with AI" button in compose modal
- [ ] Prompt input: "Write an email to..."
- [ ] Tone selector dropdown
- [ ] AI suggestions as user types
- [ ] Grammar and tone check

### 4.3 Smart Reply Chips
- [ ] Show 3 AI-generated quick replies below email
- [ ] One-click to insert reply
- [ ] Edit before sending

### 4.4 Email Insights
- [ ] Show summary at top of long emails
- [ ] Highlight action items
- [ ] Show sender context (previous emails, contact info)

---

## Phase 5: Enterprise Features (Week 9-10)

### 5.1 Email Analytics Dashboard
- [ ] Emails sent/received per day
- [ ] Response time metrics
- [ ] Most contacted people
- [ ] Email volume by label/folder

### 5.2 Team Features
- [ ] Shared mailboxes
- [ ] Email delegation
- [ ] Internal chat integration

### 5.3 Security & Compliance
- [ ] AI-powered phishing detection
- [ ] Sensitive data detection (PII, passwords)
- [ ] Email encryption (PGP support)

---

## Technical Architecture

### Backend Components
```
bheem-workspace/
├── backend/
│   ├── api/
│   │   ├── mail.py              # Existing email API
│   │   └── mail_ai.py           # NEW: AI email endpoints
│   ├── services/
│   │   ├── mail_service.py      # Existing IMAP/SMTP
│   │   └── mail_ai_service.py   # NEW: AI processing
│   └── agents/
│       └── email_agent.py       # NEW: AgentBheem integration
└── frontend/
    └── dist/
        └── bheem-mail.html      # Enhanced with AI features
```

### AgentBheem Integration
```python
# mail_ai_service.py
from agentbheem.agents.socialselling.email_agent import EmailAgent
from agentbheem.providers.router import ModelRouter

class MailAIService:
    def __init__(self):
        self.router = ModelRouter()
        self.agent = EmailAgent(self.router)

    async def compose_email(self, prompt: str, tone: str = "professional"):
        result = await self.agent.execute_tool("generate_email", {
            "prompt": prompt,
            "tone": tone
        })
        return result

    async def summarize_email(self, content: str):
        # Use LLM to summarize
        pass

    async def generate_replies(self, email_content: str, count: int = 3):
        # Generate smart replies
        pass
```

### Frontend AI Panel
```javascript
// AI Sidebar component
const AISidebar = {
    async summarize(emailId) {
        const response = await fetch(`/api/v1/mail/ai/summarize`, {
            method: 'POST',
            body: JSON.stringify({ email_id: emailId })
        });
        return response.json();
    },

    async getSmartReplies(emailId) {
        const response = await fetch(`/api/v1/mail/ai/replies`, {
            method: 'POST',
            body: JSON.stringify({ email_id: emailId })
        });
        return response.json();
    },

    async composeWithAI(prompt, tone) {
        const response = await fetch(`/api/v1/mail/ai/compose`, {
            method: 'POST',
            body: JSON.stringify({ prompt, tone })
        });
        return response.json();
    }
};
```

---

## Feature Comparison

| Feature | Gmail | Outlook 365 | Bheem Mail (Current) | Bheem Mail (Planned) |
|---------|-------|-------------|---------------------|---------------------|
| Basic Email | ✅ | ✅ | ✅ | ✅ |
| Smart Compose | ✅ | ✅ | ❌ | ✅ |
| Smart Reply | ✅ | ✅ | ❌ | ✅ |
| Email Summary | ✅ | ✅ | ❌ | ✅ |
| Priority Inbox | ✅ | ✅ | ❌ | ✅ |
| AI Search | ✅ | ✅ | ❌ | ✅ |
| Action Items | ✅ | ✅ | ❌ | ✅ |
| Follow-up Nudge | ✅ | ✅ | ❌ | ✅ |
| Unsubscribe | ✅ | ✅ | ❌ | ✅ |
| Calendar Integration | ✅ | ✅ | ❌ | ✅ (Phase 5) |
| Custom AI Agent | ❌ | ❌ | ❌ | ✅ (AgentBheem) |
| Self-Hosted | ❌ | ❌ | ✅ | ✅ |
| Open Source | ❌ | ❌ | ✅ | ✅ |

---

## Dependencies

### Required Services
- **Mailcow** (mail.bheem.cloud) - IMAP/SMTP backend
- **AgentBheem CLI** - AI agent framework
- **LiteLLM** - Multi-model routing (Claude, GPT-4, DeepSeek)

### API Keys Needed
- Anthropic API (Claude)
- OpenAI API (GPT-4) - optional
- DeepSeek API - optional

---

## Getting Started

### Step 1: Copy AgentBheem Email Components
```bash
# From socialselling.ai
scp -i /root/.ssh/sundeep root@socialselling.ai:/root/bheem-platform/modules/agentbheem-cli/agentbheem/agents/socialselling/email_agent.py \
    /root/bheem-workspace/backend/agents/

scp -i /root/.ssh/sundeep root@socialselling.ai:/root/bheem-platform/modules/agentbheem-cli/agentbheem/tools/socialselling/email_tools.py \
    /root/bheem-workspace/backend/services/
```

### Step 2: Create AI Mail API
```bash
# Create new API file
touch /root/bheem-workspace/backend/api/mail_ai.py
```

### Step 3: Update Frontend
```bash
# Add AI panel to bheem-mail.html
# Integrate AI compose and smart reply
```

---

## Success Metrics

1. **User Engagement**
   - AI compose usage rate
   - Smart reply click rate
   - Summary view rate

2. **Efficiency**
   - Time to compose email (with vs without AI)
   - Emails processed per session
   - Inbox zero achievement rate

3. **Quality**
   - AI-composed email edit rate (lower = better)
   - Reply accuracy (user acceptance)
   - Summary accuracy (user feedback)

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | Week 1-2 | AI Compose, Smart Reply |
| Phase 2 | Week 3-4 | Summarization, Priority Inbox |
| Phase 3 | Week 5-6 | Email Agent, Automation |
| Phase 4 | Week 7-8 | Frontend AI Integration |
| Phase 5 | Week 9-10 | Enterprise Features |

---

## Next Steps

1. **Immediate**: Copy AgentBheem email components to workspace
2. **This Week**: Implement AI compose endpoint
3. **Next Week**: Add smart reply and summarization
4. **Following**: Frontend AI integration

---

*Document Created: December 10, 2025*
*Last Updated: December 10, 2025*
*Author: Bheem Development Team*
