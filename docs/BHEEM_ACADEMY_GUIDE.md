# Bheem Academy - LMS Integration Guide

## Overview

Bheem Academy is a modern Learning Management System built with FastAPI + Vue.js that reads from Moodle's database while providing a superior user experience. It integrates with Bheem Passport for SSO and can leverage Bheem Workspace for live classes.

**Repository**: `/root/bheem-academy`
**Port**: 8030
**Database**: Moodle DB (read) + ERP DB (auth)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     BHEEM ACADEMY                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              VUE.JS 3 FRONTEND (PWA)                       │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │  │
│  │  │ Courses │ │ Quizzes │ │ Forums  │ │Dashboard│          │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          │  │
│  └───────┼───────────┼───────────┼───────────┼───────────────┘  │
│          │           │           │           │                   │
│          └───────────┴─────┬─────┴───────────┘                   │
│                            ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              FASTAPI BACKEND (Port 8030)                   │  │
│  │                                                            │  │
│  │  /api/auth      → Bheem Passport SSO                      │  │
│  │  /api/courses   → Course catalog, enrollment              │  │
│  │  /api/quizzes   → Quiz engine, results                    │  │
│  │  /api/assignments → Submissions, grading                  │  │
│  │  /api/forums    → Discussions                             │  │
│  │  /api/grades    → Gradebook                               │  │
│  │  /api/badges    → Achievements                            │  │
│  │  /api/calendar  → Events, deadlines                       │  │
│  │  /api/blog      → Blog posts                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│          ┌─────────────────┼─────────────────┐                   │
│          ▼                 ▼                 ▼                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │   Moodle DB  │ │   ERP DB     │ │Bheem Passport│            │
│  │  (Read Only) │ │ (auth.users) │ │    (SSO)     │            │
│  │              │ │              │ │              │            │
│  │ 619 tables   │ │ User mapping │ │ OAuth 2.0    │            │
│  │ 19 courses   │ │ Company:     │ │ JWT tokens   │            │
│  │ 52 enrolls   │ │   BHM008     │ │              │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
/root/bheem-academy/
├── backend/
│   ├── main.py                    # FastAPI entry point
│   ├── requirements.txt           # Dependencies
│   ├── .env                       # Environment variables
│   │
│   ├── core/
│   │   ├── database.py            # Dual DB connections
│   │   └── config.py              # Settings
│   │
│   ├── models/
│   │   ├── moodle_models.py       # Moodle table mappings
│   │   └── erp_models.py          # ERP user mapping
│   │
│   ├── schemas/                   # Pydantic models
│   │   ├── auth.py
│   │   ├── course.py
│   │   └── ...
│   │
│   ├── api/                       # Endpoints
│   │   ├── auth.py
│   │   ├── courses.py
│   │   ├── quizzes.py
│   │   ├── assignments.py
│   │   ├── forums.py
│   │   ├── grades.py
│   │   ├── badges.py
│   │   ├── calendar.py
│   │   ├── dashboard.py
│   │   └── blog.py
│   │
│   ├── services/                  # Business logic
│   │   ├── course_service.py
│   │   └── ...
│   │
│   └── platform_auth_client.py    # Bheem Passport
│
├── frontend/
│   ├── courses/
│   │   ├── catalog.html
│   │   ├── detail.html
│   │   └── my-courses.html
│   ├── quizzes/
│   │   ├── list.html
│   │   └── take.html
│   ├── dashboard/
│   │   └── index.html
│   └── ...
│
└── docs/
```

---

## Feature Summary

| Category | Features | Status |
|----------|----------|--------|
| **Authentication** | SSO, Registration, Profile | Complete |
| **Courses** | Catalog, Enrollment, Content, Progress | Complete |
| **Assignments** | Submit, Grade, Feedback, Resubmit | Complete |
| **Quizzes** | MCQ, Essay, Timer, Review | Complete |
| **Forums** | Discussions, Replies, Subscribe | Complete |
| **Grades** | Gradebook, Reports, Export | Complete |
| **Badges** | Achievements, Certificates | Complete |
| **Calendar** | Events, Reminders, iCal | Complete |
| **Blog** | Posts, Tags, Comments | Complete |
| **Mobile** | PWA, Offline, Push | Complete |

---

## Database Configuration

### Dual Database Setup

```python
# core/database.py

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Moodle Database (Read Only)
MOODLE_DATABASE_URL = os.getenv("MOODLE_DATABASE_URL")
moodle_engine = create_async_engine(
    MOODLE_DATABASE_URL,
    pool_pre_ping=True,
    echo=False
)
MoodleSession = sessionmaker(
    moodle_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# ERP Database (Read/Write for user mappings)
ERP_DATABASE_URL = os.getenv("ERP_DATABASE_URL")
erp_engine = create_async_engine(
    ERP_DATABASE_URL,
    pool_pre_ping=True,
    echo=False
)
ERPSession = sessionmaker(
    erp_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_moodle_db():
    async with MoodleSession() as session:
        yield session

async def get_erp_db():
    async with ERPSession() as session:
        yield session
```

### User Mapping Table

```sql
-- In ERP database, academy schema
CREATE TABLE academy.user_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_user_id UUID NOT NULL REFERENCES auth.users(id),
    moodle_user_id INTEGER NOT NULL,  -- mdl_user.id
    synced_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(erp_user_id),
    UNIQUE(moodle_user_id)
);
```

---

## API Endpoints

### Authentication

```python
# api/auth.py

@router.post("/login")
async def login(credentials: LoginRequest):
    """
    Authenticate via Bheem Passport and get Moodle user
    """
    # 1. Authenticate with Bheem Passport
    passport_client = BheemPassportClient()
    token_response = await passport_client.authenticate(
        username=credentials.username,
        password=credentials.password,
        company_code="BHM008"  # Academy company
    )

    # 2. Get or create Moodle user mapping
    erp_user_id = token_response["user"]["id"]
    moodle_user = await get_or_create_moodle_mapping(
        erp_user_id=erp_user_id,
        email=token_response["user"]["email"]
    )

    return {
        "access_token": token_response["access_token"],
        "user": {
            **token_response["user"],
            "moodle_id": moodle_user.moodle_user_id
        }
    }

@router.get("/me")
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    moodle_db: AsyncSession = Depends(get_moodle_db)
):
    """Get current user with Moodle profile"""
    # Verify with Bheem Passport
    passport_client = BheemPassportClient()
    user = await passport_client.verify_token(token)

    # Get Moodle user details
    moodle_user = await moodle_db.execute(
        select(MdlUser).where(MdlUser.email == user["email"])
    )

    return {
        **user,
        "moodle_profile": moodle_user.scalar()
    }
```

### Courses

```python
# api/courses.py

@router.get("/courses")
async def list_courses(
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    moodle_db: AsyncSession = Depends(get_moodle_db)
):
    """List available courses"""
    query = select(MdlCourse).where(MdlCourse.visible == 1)

    if category_id:
        query = query.where(MdlCourse.category == category_id)

    if search:
        query = query.where(
            MdlCourse.fullname.ilike(f"%{search}%") |
            MdlCourse.summary.ilike(f"%{search}%")
        )

    query = query.offset(skip).limit(limit)
    result = await moodle_db.execute(query)

    return result.scalars().all()

@router.get("/courses/{course_id}")
async def get_course(
    course_id: int,
    moodle_db: AsyncSession = Depends(get_moodle_db)
):
    """Get course details with sections"""
    # Get course
    course = await moodle_db.get(MdlCourse, course_id)
    if not course:
        raise HTTPException(404, "Course not found")

    # Get sections
    sections = await moodle_db.execute(
        select(MdlCourseSection)
        .where(MdlCourseSection.course == course_id)
        .order_by(MdlCourseSection.section)
    )

    # Get modules (activities)
    modules = await moodle_db.execute(
        select(MdlCourseModule)
        .where(MdlCourseModule.course == course_id)
        .where(MdlCourseModule.visible == 1)
    )

    return {
        "course": course,
        "sections": sections.scalars().all(),
        "modules": modules.scalars().all()
    }

@router.post("/courses/{course_id}/enroll")
async def enroll_in_course(
    course_id: int,
    current_user: dict = Depends(get_current_user),
    moodle_db: AsyncSession = Depends(get_moodle_db)
):
    """Enroll current user in a course"""
    # Get Moodle user ID
    moodle_user_id = current_user["moodle_id"]

    # Check existing enrollment
    existing = await moodle_db.execute(
        select(MdlUserEnrolments)
        .join(MdlEnrol)
        .where(
            MdlEnrol.courseid == course_id,
            MdlUserEnrolments.userid == moodle_user_id
        )
    )

    if existing.scalar():
        raise HTTPException(400, "Already enrolled")

    # Create enrollment (self-enrollment)
    enrol = await moodle_db.execute(
        select(MdlEnrol)
        .where(
            MdlEnrol.courseid == course_id,
            MdlEnrol.enrol == "self"
        )
    )
    enrol_instance = enrol.scalar()

    if not enrol_instance:
        raise HTTPException(400, "Self-enrollment not available")

    # Add user enrollment
    enrollment = MdlUserEnrolments(
        enrolid=enrol_instance.id,
        userid=moodle_user_id,
        timestart=int(time.time()),
        status=0  # Active
    )
    moodle_db.add(enrollment)
    await moodle_db.commit()

    return {"message": "Enrolled successfully"}
```

### Quizzes

```python
# api/quizzes.py

@router.get("/courses/{course_id}/quizzes")
async def list_quizzes(
    course_id: int,
    moodle_db: AsyncSession = Depends(get_moodle_db)
):
    """List quizzes in a course"""
    quizzes = await moodle_db.execute(
        select(MdlQuiz).where(MdlQuiz.course == course_id)
    )
    return quizzes.scalars().all()

@router.post("/quizzes/{quiz_id}/start")
async def start_quiz(
    quiz_id: int,
    current_user: dict = Depends(get_current_user),
    moodle_db: AsyncSession = Depends(get_moodle_db)
):
    """Start a new quiz attempt"""
    quiz = await moodle_db.get(MdlQuiz, quiz_id)
    if not quiz:
        raise HTTPException(404, "Quiz not found")

    # Check attempt limit
    attempts = await moodle_db.execute(
        select(func.count(MdlQuizAttempt.id))
        .where(
            MdlQuizAttempt.quiz == quiz_id,
            MdlQuizAttempt.userid == current_user["moodle_id"]
        )
    )

    if quiz.attempts and attempts.scalar() >= quiz.attempts:
        raise HTTPException(400, "Maximum attempts reached")

    # Create new attempt
    attempt = MdlQuizAttempt(
        quiz=quiz_id,
        userid=current_user["moodle_id"],
        attempt=attempts.scalar() + 1,
        timestart=int(time.time()),
        state="inprogress"
    )
    moodle_db.add(attempt)
    await moodle_db.commit()

    # Get questions
    questions = await get_quiz_questions(moodle_db, quiz_id)

    return {
        "attempt_id": attempt.id,
        "questions": questions,
        "time_limit": quiz.timelimit
    }

@router.post("/quizzes/attempts/{attempt_id}/submit")
async def submit_quiz(
    attempt_id: int,
    answers: List[QuizAnswer],
    current_user: dict = Depends(get_current_user),
    moodle_db: AsyncSession = Depends(get_moodle_db)
):
    """Submit quiz answers"""
    attempt = await moodle_db.get(MdlQuizAttempt, attempt_id)
    if not attempt or attempt.userid != current_user["moodle_id"]:
        raise HTTPException(404, "Attempt not found")

    if attempt.state != "inprogress":
        raise HTTPException(400, "Attempt already submitted")

    # Grade answers
    total_score = 0
    max_score = 0

    for answer in answers:
        question = await moodle_db.get(MdlQuestion, answer.question_id)
        score = await grade_answer(question, answer.response)
        total_score += score
        max_score += question.defaultmark

    # Update attempt
    attempt.timefinish = int(time.time())
    attempt.state = "finished"
    attempt.sumgrades = total_score

    await moodle_db.commit()

    return {
        "score": total_score,
        "max_score": max_score,
        "percentage": (total_score / max_score * 100) if max_score > 0 else 0
    }
```

### Grades

```python
# api/grades.py

@router.get("/courses/{course_id}/grades")
async def get_course_grades(
    course_id: int,
    current_user: dict = Depends(get_current_user),
    moodle_db: AsyncSession = Depends(get_moodle_db)
):
    """Get user's grades for a course"""
    # Get grade items
    items = await moodle_db.execute(
        select(MdlGradeItem)
        .where(MdlGradeItem.courseid == course_id)
        .order_by(MdlGradeItem.sortorder)
    )

    grade_items = items.scalars().all()

    # Get user grades
    grades = []
    for item in grade_items:
        grade = await moodle_db.execute(
            select(MdlGradeGrade)
            .where(
                MdlGradeGrade.itemid == item.id,
                MdlGradeGrade.userid == current_user["moodle_id"]
            )
        )

        grades.append({
            "item": item,
            "grade": grade.scalar()
        })

    # Calculate course total
    total_points = sum(g["grade"].finalgrade or 0 for g in grades if g["grade"])
    max_points = sum(g["item"].grademax or 0 for g in grades)

    return {
        "grades": grades,
        "total": total_points,
        "max": max_points,
        "percentage": (total_points / max_points * 100) if max_points > 0 else 0
    }
```

---

## Integration with Bheem Workspace

### Live Classes Integration

```python
# services/live_class_service.py

from workspace_client import WorkspaceClient

workspace = WorkspaceClient()

class LiveClassService:

    async def create_live_class(
        self,
        course_id: int,
        title: str,
        scheduled_time: datetime,
        teacher_token: str,
        moodle_db: AsyncSession
    ) -> dict:
        """Create a live class for a course"""

        # Get course info
        course = await moodle_db.get(MdlCourse, course_id)

        # Create meeting room via Workspace
        room = await workspace.create_meeting_room(
            room_name=f"academy-course-{course_id}-{int(scheduled_time.timestamp())}",
            title=f"Live Class: {title}",
            access_token=teacher_token
        )

        # Create calendar event for enrolled students
        enrollments = await self._get_course_enrollments(moodle_db, course_id)

        for enrollment in enrollments:
            user = await moodle_db.get(MdlUser, enrollment.userid)
            if user and user.email:
                # Create calendar event
                await workspace.create_event(
                    calendar_id="work",
                    title=f"Live Class: {title}",
                    start=scheduled_time.isoformat(),
                    end=(scheduled_time + timedelta(hours=1)).isoformat(),
                    nc_user=user.username,
                    nc_pass=user.password,  # Or use SSO
                    location=room["join_url"],
                    description=f"Join the live class for {course.fullname}"
                )

        return {
            "room_name": room["room_name"],
            "join_url": room["join_url"],
            "scheduled_time": scheduled_time.isoformat()
        }

    async def get_join_token(
        self,
        room_name: str,
        participant_name: str,
        user_token: str
    ) -> str:
        """Get token to join a live class"""
        return await workspace.get_meeting_token(
            room_name=room_name,
            participant_name=participant_name,
            access_token=user_token
        )
```

### Course Materials via Docs

```python
# services/materials_service.py

class MaterialsService:

    async def upload_course_material(
        self,
        course_id: int,
        file_content: bytes,
        filename: str,
        teacher_credentials: dict
    ) -> dict:
        """Upload course material to Nextcloud"""

        result = await workspace.upload_file(
            file_content=file_content,
            filename=filename,
            path=f"/Academy/Courses/{course_id}/Materials",
            nc_user=teacher_credentials["username"],
            nc_pass=teacher_credentials["password"]
        )

        return {
            "path": result["path"],
            "share_url": await workspace.get_share_link(
                path=result["path"],
                nc_user=teacher_credentials["username"],
                nc_pass=teacher_credentials["password"]
            )
        }

    async def list_course_materials(
        self,
        course_id: int,
        credentials: dict
    ) -> list:
        """List course materials"""

        return await workspace.list_files(
            path=f"/Academy/Courses/{course_id}/Materials",
            nc_user=credentials["username"],
            nc_pass=credentials["password"]
        )
```

---

## Moodle Models Reference

```python
# models/moodle_models.py

class MdlUser(Base):
    __tablename__ = "mdl_user"

    id = Column(BigInteger, primary_key=True)
    username = Column(String(100))
    email = Column(String(100))
    firstname = Column(String(100))
    lastname = Column(String(100))
    picture = Column(BigInteger)
    confirmed = Column(SmallInteger)
    deleted = Column(SmallInteger)

class MdlCourse(Base):
    __tablename__ = "mdl_course"

    id = Column(BigInteger, primary_key=True)
    category = Column(BigInteger)
    fullname = Column(String(254))
    shortname = Column(String(255))
    summary = Column(Text)
    format = Column(String(21))
    visible = Column(SmallInteger)
    startdate = Column(BigInteger)
    enddate = Column(BigInteger)

class MdlCourseSection(Base):
    __tablename__ = "mdl_course_sections"

    id = Column(BigInteger, primary_key=True)
    course = Column(BigInteger)
    section = Column(BigInteger)
    name = Column(String(255))
    summary = Column(Text)
    sequence = Column(Text)  # Comma-separated module IDs
    visible = Column(SmallInteger)

class MdlCourseModule(Base):
    __tablename__ = "mdl_course_modules"

    id = Column(BigInteger, primary_key=True)
    course = Column(BigInteger)
    module = Column(BigInteger)  # FK to mdl_modules
    instance = Column(BigInteger)  # FK to activity table
    section = Column(BigInteger)
    visible = Column(SmallInteger)

class MdlQuiz(Base):
    __tablename__ = "mdl_quiz"

    id = Column(BigInteger, primary_key=True)
    course = Column(BigInteger)
    name = Column(String(255))
    intro = Column(Text)
    timeopen = Column(BigInteger)
    timeclose = Column(BigInteger)
    timelimit = Column(BigInteger)  # In seconds
    attempts = Column(Integer)
    grade = Column(Numeric(10, 5))

class MdlAssign(Base):
    __tablename__ = "mdl_assign"

    id = Column(BigInteger, primary_key=True)
    course = Column(BigInteger)
    name = Column(String(255))
    intro = Column(Text)
    duedate = Column(BigInteger)
    allowsubmissionsfromdate = Column(BigInteger)
    grade = Column(BigInteger)

class MdlForum(Base):
    __tablename__ = "mdl_forum"

    id = Column(BigInteger, primary_key=True)
    course = Column(BigInteger)
    type = Column(String(20))
    name = Column(String(255))
    intro = Column(Text)

class MdlBadge(Base):
    __tablename__ = "mdl_badge"

    id = Column(BigInteger, primary_key=True)
    name = Column(String(255))
    description = Column(Text)
    courseid = Column(BigInteger)
    status = Column(SmallInteger)

class MdlGradeItem(Base):
    __tablename__ = "mdl_grade_items"

    id = Column(BigInteger, primary_key=True)
    courseid = Column(BigInteger)
    itemname = Column(String(255))
    itemtype = Column(String(30))
    itemmodule = Column(String(30))
    grademax = Column(Numeric(10, 5))
    grademin = Column(Numeric(10, 5))

class MdlGradeGrade(Base):
    __tablename__ = "mdl_grade_grades"

    id = Column(BigInteger, primary_key=True)
    itemid = Column(BigInteger)
    userid = Column(BigInteger)
    rawgrade = Column(Numeric(10, 5))
    finalgrade = Column(Numeric(10, 5))
```

---

## Environment Configuration

```bash
# .env

# Bheem Platform
BHEEM_PASSPORT_URL=https://platform.bheem.co.uk
BHEEM_COMPANY_CODE=BHM008

# Databases
MOODLE_DATABASE_URL=postgresql+asyncpg://user:pass@65.109.167.218:5432/bheem_academy_staging
ERP_DATABASE_URL=postgresql+asyncpg://user:pass@65.109.167.218:5432/erp_staging

# API
PORT=8030
HOST=0.0.0.0
CORS_ORIGINS=https://academy.bheem.cloud,https://newdesign.bheem.cloud

# Workspace Integration (Optional)
WORKSPACE_URL=https://workspace.bheem.cloud

# Logging
LOG_LEVEL=INFO
```

---

## Deployment

### Development

```bash
cd /root/bheem-academy/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8030 --reload
```

### Production

```bash
# Using Gunicorn with Uvicorn workers
gunicorn main:app \
    -w 4 \
    -k uvicorn.workers.UvicornWorker \
    -b 0.0.0.0:8030
```

### Docker

```dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8030"]
```

---

*Document Version: 1.0*
*Last Updated: December 26, 2025*
