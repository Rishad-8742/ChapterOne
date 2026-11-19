# 📚 ChapterOne – Online Bookstore

**ChapterOne** is a full-stack online bookstore application where users can explore books, manage their shopping carts, place orders, and make secure online payments.

The platform also includes an admin dashboard to manage books, users, orders, and sales analytics.

## Features

### User Features
- User registration and login
- Google authentication
- Browse and search books
- Filter and sort books
- View detailed book information
- Add books to cart
- Manage shopping cart
- Manage user profile and addresses
- Place orders
- Cash on Delivery (COD)
- Online payments using Razorpay
- Track and view order details
- Cancel eligible orders

### Admin Features
- Secure admin authentication
- Admin dashboard
- Add, edit, and delete books
- Manage book categories and genres
- Manage users
- Manage customer orders
- Update order statuses
- View sales analytics
- Revenue and sales charts

## Technologies Used

**Frontend**
- HTML5
- CSS3
- JavaScript
- EJS
- Fetch API
- Chart.js

**Backend**
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- Passport.js

**Payment Integration**
- Razorpay

**Deployment**
- AWS EC2
- Nginx
- PM2
- Git & GitHub

## Project Structure

```text
ChapterOne/
│
├── public/
│   ├── css/
│   ├── js/
│   ├── images/
│   └── uploads/
│
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── server.js
│
├── views/
│   ├── admin/
│   ├── user/
│   └── partials/
│
├── .env
├── .gitignore
├── package.json
└── README.md
```

## Installation and Setup

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2.Navigate to the Project

```bash
cd ChapterOne
```

### 3.Install Dependencies

```bash
npm install
```

### 4.Configure Environment Variables

Create a `.env` file in the root directory and configure the required environment variables.

```env
PORT=2211
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

Add any additional variables required by your application.

### 5.Start the Application

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

The application will run at:

```text
http://localhost:2211
```

## Payment Integration

ChapterOne integrates Razorpay to support online payments.

Supported payment methods:
- Cash on Delivery (COD)
- Razorpay Online Payments

## Deployment

The application is deployed using AWS EC2.

Deployment technologies:
- AWS EC2 for hosting
- Nginx as a reverse proxy
- PM2 for Node.js process management
- MongoDB for database management

## Security

- JWT-based authentication
- Protected user and admin routes
- Environment variables for sensitive credentials
- Password security
- Server-side validation

## Developer

Rishad PK

Full Stack Web Development Project

---

If you find this project interesting, feel free to explore the repository!
