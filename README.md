# NoMoreLastMinute
Group-90
# NMLM System

A comprehensive task management platform designed for student and user productivity. [cite_start]This system features secure user authentication and a relational database architecture to manage user-specific tasks efficiently[cite: 1, 3, 8].

## ## System Architecture

### ### Data Flow (DFD Level 1)
[cite_start]The **NMLM System** acts as the central hub between the user and the data storage[cite: 1, 3]:
* [cite_start]**User/Student Interactions**: Users can register accounts and perform login actions[cite: 5, 6, 2].
* [cite_start]**System Responses**: The system provides automated notifications and feedback based on user tasks and actions[cite: 7, 8].

### ### Database Design (ERD)
[cite_start]The system utilizes a relational database structure with a **one-to-many** relationship: **One user can create multiple tasks**[cite: 9, 11].

#### #### 1. User Table
[cite_start]Stores credentials and profile information[cite: 10, 13]:
* [cite_start]`id` (Primary Key) [cite: 13]
* [cite_start]`fullname` (Signup name) [cite: 13]
* [cite_start]`email` (Signup email) [cite: 13]
* [cite_start]`password` (Stored as a secure hash) [cite: 13, 24]

#### #### 2. Task Table
[cite_start]Stores task-specific data linked to the creator[cite: 12, 40]:
* [cite_start]`task_id` [cite: 40]
* [cite_start]`title` [cite: 40]
* [cite_start]`user_id` (Foreign Key linking to User Table) [cite: 40]

---

## ## Core System Processes

### ### 1. User Registration
* [cite_start]**Input**: User provides `fullname`, `email`, and `password`[cite: 17].
* [cite_start]**Trigger**: The `handleSignup()` JavaScript function is triggered via the "Create Account" button[cite: 18].
* [cite_start]**Transport**: Data is sent via a `POST` request using the `fetch` API to `http://127.0.0.1:5000/api/signup`[cite: 19, 21, 22].
* **Backend Logic**: 
    * [cite_start]**Duplicate Check**: The system queries the database using `filter_by()` to ensure the email isn't already registered[cite: 23].
    * [cite_start]**Encryption**: Passwords are protected using `generate_password_hash`[cite: 24].
* [cite_start]**Data Store**: Information is committed to the `users.db` database[cite: 25].
* [cite_start]**Output**: Upon success, a `201 Created` code is returned, and a frontend alert notification is displayed[cite: 26, 27].

### ### 2. User Authentication (Login)
* [cite_start]**Input**: User enters their registered `email` and `password`[cite: 29].
* [cite_start]**Trigger**: The `handleLogin()` function is triggered by clicking the "Login" button[cite: 30].
* [cite_start]**Transport**: A `POST` request is sent to the `/api/signin` endpoint[cite: 31].
* **Backend Logic**:
    * [cite_start]**Retrieval**: The system searches the database for the user record by email[cite: 33, 34].
    * [cite_start]**Verification**: The `check_password_hash` function compares the provided password with the stored hash[cite: 35, 36].
* **Output**: 
    * [cite_start]**Success**: Returns a `200 OK` status and user data to the frontend[cite: 37, 38, 39].
    * [cite_start]**Failure**: Returns a `401 Unauthorized` error message to the frontend[cite: 39].

---

## ## Tech Stack
* [cite_start]**Frontend**: JavaScript (Fetch API API API API) [cite: 18, 19]
* [cite_start]**Backend**: Python-based API (implied by `filter_by` and `password_hash` logic) [cite: 23, 24]
* [cite_start]**Database**: SQL-based (referred to as `users.db`) [cite: 25]