# ZipLink

**Tech stack:** React (Next.js) · Node.js (Express) · MySQL — แบบ **microservice** (API service + Redirect service แยกกัน)

ระบบย่อ URL ครบวงจร: ย่อลิงก์ได้ทันที มี QR Code ให้สแกน ดูสถิติการคลิกได้ละเอียด ตั้งรหัสผ่าน/วันหมดอายุ/จำกัดจำนวนคลิกให้ลิงก์ได้ รองรับการค้นหาและเรียงลำดับ

| | |
|---|---|
| **เว็บที่ deploy แล้ว** | **https://ziplink-rose.vercel.app** |
| **บัญชีทดสอบ** | อีเมล `test@gmail.com` · รหัสผ่าน `test1234` (มีลิงก์ตัวอย่างให้ดูสถิติแล้ว) |
| API Service | https://ziplink-api-k24f.onrender.com |
| Redirect Service | https://ziplink-redirect.onrender.com |

> **หมายเหตุ:** backend ทั้งสองอยู่บน Render free tier จะ sleep เมื่อไม่มีคนใช้งาน การเปิดเว็บครั้งแรกหลังไม่ได้ใช้นานๆ อาจช้า 30–60 วินาที เป็นเรื่องปกติของ free tier ไม่ใช่ข้อผิดพลาด

## ฟีเจอร์

**ตามเกณฑ์หลัก**
- สมัครสมาชิก / เข้าสู่ระบบ / ออกจากระบบ (รหัสผ่าน hash ด้วย bcrypt, เซสชันเป็น JWT ใน httpOnly cookie)
- ย่อ URL แล้วได้ Short URL ที่คลิกแล้ว redirect ไปยัง URL ต้นฉบับ
- สแกน QR Code แล้วเปิด URL ต้นฉบับได้ทันที ดาวน์โหลดเป็น PNG หรือคัดลอกรูปไปวางที่อื่นได้
- ประวัติลิงก์ของตัวเอง (URL ต้นฉบับ, Short URL, จำนวนคลิก) พร้อมค้นหา กรองตามสถานะ และเรียงลำดับ

**ฟีเจอร์เสริม**
- ตั้งชื่อลิงก์ไว้ดูเอง, ตั้งรหัสผ่านให้ลิงก์, ตั้งวันหมดอายุ, จำกัดจำนวนคลิกสูงสุด
- เปิด/ปิดการใช้งานลิงก์ได้ทุกเมื่อ, แก้ไข/ลบลิงก์
- สถิติรายลิงก์: คลิกทั้งหมด, แยกตามอุปกรณ์ (คอมพิวเตอร์ / มือถือ / แท็บเล็ต), กราฟเส้นช่วง 7/14/30 วันหรือทั้งหมด, ประวัติการคลิกแบ่งหน้า (โหลดทีละ 10 ไม่ดึงทั้งหมดมาครั้งเดียว)
- หน้าสถิติภาพรวม: รวมทุกลิงก์ 7/30 วันล่าสุด, Top 5 ลิงก์ที่คลิกเยอะสุด
- หน้าแจ้งสถานะเมื่อเปิดลิงก์ที่ปิดอยู่ / หมดอายุ / คลิกครบแล้ว / ไม่มีอยู่จริง

## สถาปัตยกรรม

ไดอะแกรมแบบเต็มอยู่ใน [`architecture-diagram.html`](architecture-diagram.html) และ [`deployment-diagram.html`](deployment-diagram.html) (เปิดด้วยเบราว์เซอร์ได้เลย) สรุปสั้นๆ:

```
                    HTTPS                REST API (HTTPS)
  Client ──────────────▶ Vercel (Next.js) ──────────────▶ API Service (Render)
    │                                                            │
    │  HTTPS (เปิดลิงก์สั้น / สแกน QR — ไม่ผ่าน Vercel)              │ SQL/TLS
    │                                                            ▼
    └──────────────▶ Redirect Service (Render) ──SQL/TLS──▶ TiDB Serverless (MySQL)
                              │
                              └── HTTP 302 ──▶ Original URL
```

- **API Service** (`services/api`) — ทุกอย่างที่เจ้าของลิงก์ต้องล็อกอินก่อน: สมัคร/เข้าสู่ระบบ, จัดการลิงก์, QR Code, สถิติ
- **Redirect Service** (`services/redirect`) — ทุกอย่างที่คนทั่วไปเข้าได้โดยไม่ต้องล็อกอิน: เปิดลิงก์สั้น, ฟอร์มใส่รหัสผ่านลิงก์
- **ทั้งสอง service ไม่เรียกหากันโดยตรง** คุยกันผ่านฐานข้อมูล MySQL เดียวกันเท่านั้น (API สร้าง/แก้ลิงก์ → Redirect อ่านไปใช้ตรวจสอบและนับคลิก) — deploy, scale และทดสอบแยกจากกันได้อิสระ
- **ลิงก์สั้นชี้ไปที่โดเมนของ Redirect Service โดยตรง** ไม่ผ่าน Next.js เลย จึงไม่ต้องล็อกอินและไม่กินทรัพยากรของหน้าเว็บ
- **Frontend** เรียก REST API ผ่าน `/api/*` ที่ Next.js proxy ไปยัง service ที่ถูกต้องให้อัตโนมัติ (คนละ service กันตามเส้นทาง) ทำให้ cookie เป็น first-party ใช้งานได้ทุกเบราว์เซอร์ (รวม Safari/iOS ที่บล็อก third-party cookie)

## เอกสารออกแบบ

DFD, ER Diagram, Architecture Diagram และ Deployment Diagram ส่งแยกเป็นเอกสารต่างหาก (ไม่ได้รวมอยู่ใน repo นี้)

โครงสร้างตารางจริงอยู่ที่ [`db/schema.sql`](db/schema.sql)

## โครงสร้างโปรเจกต์

```
services/
  api/          REST API (auth, จัดการลิงก์, QR, สถิติ) — PORT 4000
    src/routes/   auth.js, links.js, stats.js
  redirect/     Redirect service (เปิดลิงก์สั้น, ฟอร์มรหัสผ่าน) — PORT 4002
    src/routes/   redirect.js, public.js
db/             schema.sql + migrate.js — ใช้ร่วมกันทั้งสอง service
test/           ทดสอบการทำงานร่วมกันระหว่าง 2 service (รันทั้งคู่พร้อมกันจริง)
frontend/       Next.js (App Router) + Tailwind CSS
  app/            login, register, dashboard (ย่อลิงก์), links (ลิงก์ของฉัน), stats, status/[type]
  components/     ฟอร์ม, QR Code, กราฟ, popup สถิติ
render.yaml     ตั้งค่า deploy ทั้งสอง backend บน Render อัตโนมัติ (Blueprint)
docker-compose.yml
```

## วิธีที่ 1: รันด้วย Docker (แนะนำ)

ต้องมี [Docker Desktop](https://www.docker.com/products/docker-desktop/) และเปิดโปรแกรมไว้ก่อน ไม่ต้องติดตั้ง Node.js หรือ MySQL

```bash
docker compose up --build
```

รอจน log ขึ้นว่าทุก service พร้อมแล้ว จากนั้นเปิด **http://localhost:3000** แล้วสมัครสมาชิกเพื่อเริ่มใช้งาน
ตารางในฐานข้อมูลถูกสร้างให้อัตโนมัติครั้งแรกที่รัน

| Service | URL |
|---|---|
| Frontend (เปิดหน้านี้) | http://localhost:3000 |
| API Service | http://localhost:4000 |
| Redirect Service / Short URL | http://localhost:4002 |
| phpMyAdmin (ดูฐานข้อมูล) | http://localhost:8080 |
| MySQL (สำหรับ SQL client) | localhost:3307 · user `root` · รหัสผ่าน `rootpassword` · ฐานข้อมูล `short_url` |

หยุดระบบ: `docker compose down` (เก็บข้อมูลไว้) หรือ `docker compose down -v` (ลบข้อมูลทั้งหมด)

## วิธีที่ 2: รันแยกเองบนเครื่อง

ต้องมี **Node.js 20+** และ **MySQL 8**

### 1. ฐานข้อมูล

```sql
CREATE DATABASE short_url CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
# จากโฟลเดอร์โปรเจกต์หลัก (ตั้งค่า DATABASE_URL เป็น env ก่อนรัน หรือสร้าง .env ที่ root)
node db/migrate.js
```

### 2. API Service (port 4000)

```bash
cd services/api
npm install
cp .env.example .env      # แล้วแก้ DATABASE_URL และ JWT_SECRET
npm run dev                # หรือ npm start
```

| ตัวแปรสำคัญใน `.env` | ความหมาย |
|---|---|
| `DATABASE_URL` | connection string ของ MySQL (ใช้ร่วมกับ redirect service) |
| `JWT_SECRET` | คีย์สำหรับเซ็น JWT ต้องเป็นค่าสุ่มยาวๆ |
| `FRONTEND_URL` | URL ของ frontend (สำหรับ CORS) |
| `REDIRECT_BASE_URL` | URL ของ redirect service — ใช้สร้าง Short URL และ QR Code |

### 3. Redirect Service (port 4002)

```bash
cd services/redirect
npm install
cp .env.example .env      # แล้วแก้ DATABASE_URL
npm run dev
```

| ตัวแปรสำคัญใน `.env` | ความหมาย |
|---|---|
| `DATABASE_URL` | connection string **เดียวกัน**กับ API Service |
| `FRONTEND_URL` | URL ของ frontend (ไปหน้า `/status/<state>` และ `/unlock/<code>`) |

### 4. Frontend (port 3000)

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

```env
# frontend/.env.local
API_URL=http://localhost:4000
REDIRECT_API_URL=http://localhost:4002
```

เปิด http://localhost:3000 แล้วสมัครสมาชิกเพื่อเริ่มใช้งาน

## Deploy ขึ้นจริง

| ส่วน | Host | วิธี |
|---|---|---|
| Frontend | **Vercel** | Import repo → Root Directory ตั้งเป็น `frontend` → ตั้ง env `API_URL`, `REDIRECT_API_URL` ชี้ไป Render |
| API + Redirect Service | **Render** | ใช้ [`render.yaml`](https://github.com/Bestzxc/short-url/blob/main/render.yaml) ที่ root ของโปรเจกต์ → New → Blueprint → เลือก repo → กรอก `DATABASE_URL`, `FRONTEND_URL`, `REDIRECT_BASE_URL` |
| Database | **TiDB Serverless** | สร้าง cluster ฟรี, สร้าง database `short_url`, รัน `db/migrate.js` ครั้งเดียวเพื่อสร้างตาราง |

## การทดสอบอัตโนมัติ

| ชุดทดสอบ | คำสั่ง | ครอบคลุม |
|---|---|---|
| API Service | `cd services/api && npm test` | auth, จัดการลิงก์, QR, สถิติ, แบ่งหน้าประวัติคลิก (26 ข้อ) |
| Redirect Service | `cd services/redirect && npm test` | redirect, สถานะลิงก์, รหัสผ่านลิงก์, rate limit (10 ข้อ) |
| ทำงานร่วมกันระหว่าง 2 service | `cd test && npm test` | สร้างลิงก์ที่ API แล้วเปิดที่ Redirect จริง, แก้รหัสผ่าน/ปิดลิงก์มีผลทันที (4 ข้อ) |

ทุกชุดทดสอบใช้ MySQL ชั่วคราวแยกจากฐานข้อมูลจริง ดูวิธีตั้งค่าในคอมเมนต์บนสุดของแต่ละ `test/helpers.js`

โค้ดผ่านการตรวจสอบคุณภาพด้วย SonarQube แล้ว (ตั้งค่าไว้ที่ `sonar-project.properties`)

## REST API

### API Service — ต้องล็อกอิน (ยกเว้นที่ระบุ) เข้าถึงได้เฉพาะลิงก์ของตัวเอง

| Method | Path | คำอธิบาย |
|---|---|---|
| POST | `/api/auth/register` | สมัครสมาชิก `{ email, password }` |
| POST | `/api/auth/login` | เข้าสู่ระบบ `{ email, password }` |
| POST | `/api/auth/logout` | ออกจากระบบ |
| GET | `/api/auth/me` | ข้อมูลผู้ใช้ที่ล็อกอินอยู่ |
| GET | `/api/links` | ประวัติลิงก์ + จำนวนคลิก |
| POST | `/api/links` | สร้าง Short URL `{ originalUrl, title?, expiresAt?, maxClicks?, linkPassword? }` |
| PATCH | `/api/links/:id` | แก้ไขลิงก์ (เปิด/ปิด, ชื่อ, วันหมดอายุ, จำกัดคลิก, รหัสผ่าน) |
| DELETE | `/api/links/:id` | ลบลิงก์ (ประวัติคลิกถูกลบตาม ON DELETE CASCADE) |
| GET | `/api/links/:id/qr` | QR Code PNG (`?download=1` เพื่อดาวน์โหลด) |
| GET | `/api/links/:id/stats` | สถิติรายลิงก์ (`?range=7\|14\|30\|all`) |
| GET | `/api/links/:id/clicks` | ประวัติการคลิกแบ่งหน้า (`?page=`, `?limit=`) |
| GET | `/api/stats` | สถิติภาพรวมทุกลิงก์ (`?days=7\|30`) |
| GET | `/health` | health check |

### Redirect Service — ไม่ต้องล็อกอิน

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/:shortCode` | redirect ไปยัง URL ต้นฉบับและบันทึกการคลิก |
| POST | `/api/public/links/:code/unlock` | ส่งรหัสผ่านของลิงก์ที่ป้องกันไว้ `{ password }` |
| GET | `/health` | health check |
