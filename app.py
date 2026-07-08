import os
import random
import jwt
from datetime import datetime, timedelta
from sqlalchemy import inspect, text
from flask import Flask, request, jsonify 
from flask_sqlalchemy import SQLAlchemy 
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS 
from flask_mail import Mail, Message 

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False, allow_headers=['Content-Type', 'Authorization'], methods=['GET','POST','PUT','DELETE','OPTIONS'])

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'joanwanni1201@gmail.com'  
app.config['MAIL_PASSWORD'] = 'nsnv sntp ywop umoe'      
app.config['MAIL_DEFAULT_SENDER'] = 'joanwanni1201@gmail.com'

mail = Mail(app)

SECRET_KEY = 'your-secret-key-change-this'

basedir = os.path.abspath(os.path.dirname(__file__)) 
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'nmlm_users.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app) 

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fullname = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    is_verified = db.Column(db.Boolean, default=False)
    pomodoro_seconds = db.Column(db.Integer, default=0)

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    color = db.Column(db.String(32), default='#007AFF')
    time = db.Column(db.String(64), default='')
    date = db.Column(db.String(12), nullable=False)
    status = db.Column(db.String(32), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_email = db.Column(db.String(120), nullable=True)

class Mood(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_email = db.Column(db.String(120), nullable=True)
    date = db.Column(db.String(12), nullable=False)
    mood = db.Column(db.String(32), default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

with app.app_context():
    db.create_all()
    inspector = inspect(db.engine)
    if 'user' in inspector.get_table_names():
        existing_columns = [column['name'] for column in inspector.get_columns('user')]
        if 'pomodoro_seconds' not in existing_columns:
            db.session.execute(text('ALTER TABLE user ADD COLUMN pomodoro_seconds INTEGER DEFAULT 0'))
            if 'pomodoro_minutes' in existing_columns:
                db.session.execute(text('UPDATE user SET pomodoro_seconds = COALESCE(pomodoro_minutes, 0) * 60'))
            db.session.commit()
    print("Database initialized at:", app.config['SQLALCHEMY_DATABASE_URI'])


verification_codes = {}

def get_current_user():
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1]
    else:
        token = None

    if not token:
        return None

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        user_id = payload.get('user_id')
        if user_id:
            return User.query.get(user_id)
        email = payload.get('email')
        if email:
            return User.query.filter_by(email=email).first()
    except Exception:
        return None

    return None


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
    else:
        response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response


def send_verification_email(email, fullname):
    try:
        token = jwt.encode({
            'email': email,
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, SECRET_KEY, algorithm='HS256')
        
        verification_url = f'http://127.0.0.1:5000/api/verify/{token}'
        
        msg = Message(
            'Verify your No More Last Minute account',
            recipients=[email]
        )
        msg.body = f'''Hi {fullname},

Welcome to No More Last Minute!

Please verify your email by clicking the link below:
{verification_url}

This link will expire in 24 hours.

If you didn't create an account, please ignore this email.

Best regards,
No More Last Minute Team'''
        
        mail.send(msg)
        print(f"Verification email sent to {email}")
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False


@app.route('/api/verify/<token>', methods=['GET'])
def verify_email(token):
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        email = data['email']
        
        user = User.query.filter_by(email=email).first()
        if user:
            user.is_verified = True
            db.session.commit()
            return jsonify({"message": "Email verified successfully!"}), 200
        else:
            return jsonify({"message": "User not found"}), 404
    except jwt.ExpiredSignatureError:
        return jsonify({"message": "Verification link expired"}), 400
    except Exception as e:
        return jsonify({"message": "Invalid token"}), 400


@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    code = data.get('code', '').strip()
    
    if not email or not code:
        return jsonify({"message": "Email and verification code are required"}), 400
        
    otp_data = verification_codes.get(email)
    
    if not otp_data:
        return jsonify({"message": "Verification code not found. Please resend."}), 400
        
    if datetime.utcnow() > otp_data['expires']:
        del verification_codes[email]
        return jsonify({"message": "Verification code expired. Please request a new one."}), 400
        
    if otp_data['code'] == code:
        user = User.query.filter_by(email=email).first()
        if user:
            user.is_verified = True
            db.session.commit()
            if email in verification_codes:
                del verification_codes[email] 
            print(f"OTP verification success for {email}")
            return jsonify({"message": "Email verified successfully!"}), 200
        else:
            return jsonify({"message": "User not found"}), 404
            
    return jsonify({"message": "Invalid verification code"}), 400


@app.route('/api/resend-otp', methods=['POST'])
def resend_otp():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    
    if not email:
        return jsonify({"message": "Email is required"}), 400
    
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    otp = str(random.randint(100000, 999999))
    verification_codes[email] = {
        'code': otp,
        'expires': datetime.utcnow() + timedelta(minutes=10)
    }
    
    try:
        msg = Message(
            'Your No More Last Minute Verification Code',
            recipients=[email]
        )
        msg.body = f'''Hi {user.fullname},

Your verification code is: {otp}

This code will expire in 10 minutes.

If you didn't request this, please ignore this email.

Best regards,
No More Last Minute Team'''
        
        mail.send(msg)
        print(f"OTP resent to {email}: {otp}")
        return jsonify({"message": "Verification code sent"}), 200
    except Exception as e:
        print(f"Error sending OTP: {str(e)}")
        return jsonify({"message": "Failed to send verification code"}), 500


@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    fullname = data.get('fullname', '').strip()
    password = data.get('password')
    
    print(f"--- Signup Attempt: {email} ---") 
    
    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400
        
    if User.query.filter_by(email=email).first():
        print("Signup failed: Email already exists.")
        return jsonify({"message": "Email already registered"}), 400
    
    hashed_pw = generate_password_hash(password)
    
    new_user = User(
        fullname=fullname,
        email=email,
        password=hashed_pw,
        is_verified=False
    )
    
    try:
        db.session.add(new_user)
        db.session.commit()
        print(f"Signup success: User {new_user.fullname} added to DB.")
        
        otp = str(random.randint(100000, 999999))
        verification_codes[email] = {
            'code': otp,
            'expires': datetime.utcnow() + timedelta(minutes=10)
        }
        
        try:
            msg = Message(
                'Your No More Last Minute Verification Code',
                recipients=[email]
            )
            msg.body = f'''Hi {new_user.fullname},

Welcome to No More Last Minute!

Your verification code is: {otp}

This code will expire in 10 minutes.

If you didn't create an account, please ignore this email.

Best regards,
No More Last Minute Team'''
            mail.send(msg)
            print(f"OTP sent to {email}: {otp}")
        except Exception as e:
            print(f"Error sending OTP: {str(e)}")
        
        return jsonify({"message": "Account created! Please check your email to verify your account."}), 201
    except Exception as e:
        print(f"DB Error: {str(e)}")
        return jsonify({"message": "Database error"}), 500


@app.route('/api/signin', methods=['POST'])
def signin():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    password = data.get('password')
    
    print(f"--- Signin Attempt: {email} ---") 
    
    user = User.query.filter_by(email=email).first()
    
    if user:
        print(f"User found: {user.fullname}, checking password...")
        if check_password_hash(user.password, password):
            
            if not user.is_verified:
                print(f"Signin intercepted: {email} is not verified.")
                return jsonify({
                    "message": "Email not verified",
                    "needs_verification": True,
                    "email": user.email
                }), 403
                
            print("Password matches! Access granted.")
            token = jwt.encode({
                'user_id': user.id,
                'email': user.email,
                'exp': datetime.utcnow() + timedelta(hours=12) 
            }, SECRET_KEY, algorithm='HS256')
            return jsonify({
                "message": "Login successful!",
                "token": token,
                "user": {
                    "id": user.id, 
                    "fullname": user.fullname, 
                    "email": user.email
                }
            }), 200
        else:
            print("Password mismatch!")
    else:
        print("User not found in database.")
    
    return jsonify({"message": "Invalid email or password"}), 401


def serialize_task(task):
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "color": task.color,
        "time": task.time,
        "date": task.date,
        "status": task.status,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
        "user_email": task.user_email,
    }

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    date_key = (request.args.get('date') or '').strip()
    if not date_key:
        return jsonify({"message": "Date parameter is required"}), 400

    tasks_query = Task.query.filter_by(date=date_key)
    current_user = get_current_user()
    if current_user:
        tasks_query = tasks_query.filter_by(user_email=current_user.email)
    else:
        user_email = (request.args.get('user_email') or '').strip()
        if user_email:
            tasks_query = tasks_query.filter_by(user_email=user_email)

    return jsonify([serialize_task(task) for task in tasks_query]), 200

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    if not title:
        return jsonify({"message": "Task title is required"}), 400
    date_key = (data.get('date') or data.get('dateKey') or '').strip()
    if not date_key:
        return jsonify({"message": "Task date is required"}), 400

    current_user = get_current_user()
    user_email = None
    if current_user:
        user_email = current_user.email
    else:
        user_email = (data.get('user_email') or data.get('email') or '').strip() or None

    new_task = Task(
        title=title,
        description=data.get('description', '').strip(),
        color=data.get('color', '#007AFF'),
        time=data.get('time', ''),
        date=date_key,
        status=data.get('status', 'pending'),
        user_email=user_email
    )
    db.session.add(new_task)
    db.session.commit()
    return jsonify({"task": serialize_task(new_task)}), 201                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     

@app.route('/api/tasks/<int:task_id>/toggle', methods=['POST'])
def toggle_task_status(task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"message": "Task not found"}), 404
    task.status = 'completed' if task.status != 'completed' else 'pending'
    db.session.commit()
    return jsonify({"task": serialize_task(task)}), 200

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"message": "Task not found"}), 404
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Task deleted"}), 200

@app.route('/api/user/info', methods=['GET'])
def get_user_info():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Unauthorized"}), 401
    return jsonify({
        "user": {
            "id": user.id,
            "fullname": user.fullname,
            "email": user.email
        }
    }), 200

@app.route('/api/pomodoro/complete', methods=['POST'])
def complete_pomodoro():
    data = request.get_json() or {}
    user = get_current_user()
    if not user:
        fallback_user_id = data.get('user_id')
        fallback_email = data.get('email')
        if fallback_user_id:
            user = User.query.get(fallback_user_id)
        elif fallback_email:
            user = User.query.filter_by(email=fallback_email).first()

    if not user:
        return jsonify({"message": "Unauthorized"}), 401

    duration = data.get('duration', 0)
    try:
        duration = int(duration)
    except (ValueError, TypeError):
        duration = 0

    if duration <= 0:
        return jsonify({"message": "Invalid duration"}), 400

    user.pomodoro_seconds = (user.pomodoro_seconds or 0) + duration
    db.session.commit()

    return jsonify({
        "message": "Pomodoro session recorded",
        "total_seconds": user.pomodoro_seconds,
        "total_hours": round(user.pomodoro_seconds / 3600, 1),
        "user": {
            "id": user.id,
            "email": user.email,
            "fullname": user.fullname
        }
    }), 200

@app.route('/api/user/<int:user_id>/stats', methods=['GET'])
def get_user_stats(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404

    users = User.query.order_by(User.pomodoro_seconds.desc()).all()
    rank = next((index + 1 for index, u in enumerate(users) if u.id == user.id), len(users))

    return jsonify({
        "name": user.fullname or user.email,
        "email": user.email,
        "rank": rank,
        "total_hours": round((user.pomodoro_seconds or 0) / 3600, 1),
        "total_seconds": user.pomodoro_seconds or 0
    }), 200

@app.route('/api/user/rank', methods=['GET'])
def get_user_rank():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Unauthorized"}), 401

    users = User.query.order_by(User.pomodoro_seconds.desc()).all()
    rank = next((idx + 1 for idx, u in enumerate(users) if u.email == user.email), len(users))
    total_users = len(users)
    percentile = round(100 * (total_users - rank) / total_users) if total_users else 0

    return jsonify({
        "rank": rank,
        "percentile": percentile,
        "totalUsers": total_users
    }), 200

@app.route('/api/leaderboard/me', methods=['GET'])
def get_leaderboard_me():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Unauthorized"}), 401

    users = User.query.order_by(User.pomodoro_seconds.desc()).all()
    rank = next((idx + 1 for idx, u in enumerate(users) if u.email == user.email), len(users))
    total_users = len(users)
    percentile = round(100 * (total_users - rank) / total_users) if total_users else 0

    return jsonify({
        "rank": rank,
        "percentile": percentile,
        "total_users": total_users,
        "username": user.fullname or user.email,
        "total_hours": round((user.pomodoro_seconds or 0) / 3600, 1),
        "total_seconds": user.pomodoro_seconds or 0
    }), 200

@app.route('/api/mood', methods=['GET'])
def get_mood():
    date_key = request.args.get('date')
    if not date_key:
        return jsonify({"message": "Date query parameter is required"}), 400

    user = get_current_user()
    query = Mood.query.filter_by(date=date_key)
    if user:
        query = query.filter_by(user_email=user.email)

    mood_entry = query.order_by(Mood.updated_at.desc()).first()
    return jsonify({"mood": mood_entry.mood if mood_entry else ""}), 200

@app.route('/api/mood/today', methods=['GET'])
def get_today_mood():
    today_key = datetime.utcnow().strftime('%Y-%m-%d')
    user = get_current_user()
    query = Mood.query.filter_by(date=today_key)
    if user:
        query = query.filter_by(user_email=user.email)

    mood_entry = query.order_by(Mood.updated_at.desc()).first()
    return jsonify({"mood": mood_entry.mood if mood_entry else ""}), 200

@app.route('/api/mood', methods=['POST'])
def save_mood():
    data = request.get_json() or {}
    today_key = data.get('date')
    mood_value = data.get('mood', '').strip()
    if not today_key:
        return jsonify({"message": "Mood date is required"}), 400

    user = get_current_user()
    user_email = user.email if user else data.get('user_email')

    mood_entry = Mood.query.filter_by(date=today_key, user_email=user_email).first()
    if not mood_entry:
        mood_entry = Mood(date=today_key, user_email=user_email, mood=mood_value)
        db.session.add(mood_entry)
    else:
        mood_entry.mood = mood_value

    db.session.commit()
    return jsonify({"mood": mood_entry.mood}), 200

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task_endpoint(task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"message": "Task not found"}), 404
        
    data = request.get_json() or {}
    
    if 'title' in data: task.title = data['title']
    if 'description' in data: task.description = data['description']
    if 'color' in data: task.color = data['color']
    if 'time' in data: task.time = str(data['time'])  
    if 'date' in data: task.date = data['date']
    if 'status' in data: task.status = data['status']
    
    db.session.commit()
    return jsonify({"task": serialize_task(task)}), 200


@app.route('/api/stats/summary', methods=['GET'])
def stats_summary():
    year = request.args.get('year', type=int)
    month = request.args.get('month', type=int)
    if year is None or month is None:
        return jsonify({"message": "Year and month parameters are required"}), 400

    month_str = str(month).zfill(2)
    date_prefix = f"{year}-{month_str}-"
    tasks_query = Task.query.filter(Task.date.like(f"{date_prefix}%"))
    total = tasks_query.count()
    completed = tasks_query.filter_by(status='completed').count()
    pending = tasks_query.filter_by(status='pending').count()
    
    minutes = 0
    for task in tasks_query.all():
        if task.time:
            if ":" not in task.time:
                try:
                    minutes += int(task.time.strip())
                except ValueError:
                    pass
                    
    completion_percentage = round((completed / total) * 100) if total else 0
    return jsonify({
        "stats": {
            "total": total,
            "completed": completed,
            "pending": pending,
            "pomodoroMinutes": minutes,
            "completionPercentage": completion_percentage
        }
    }), 200

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    limit = request.args.get('limit', type=int)
    users = User.query.order_by(User.pomodoro_seconds.desc()).all()
    leaderboard_data = []

    for user in users:
        total_seconds = user.pomodoro_seconds or 0
        total_hours = round(total_seconds / 3600, 1)

        display_name = user.fullname
        if not display_name or display_name.strip() == "" or display_name == "Unknown User":
            display_name = user.email.split('@')[0] if user.email else "Foo"

        leaderboard_data.append({
            "id": user.id,
            "fullname": display_name,
            "email": user.email,
            "totalHours": total_hours,
            "totalSeconds": total_seconds
        })

    if limit is not None and isinstance(limit, int) and limit > 0:
        leaderboard_data = leaderboard_data[:limit]

    return jsonify({
        "leaderboard": leaderboard_data
    }), 200

@app.route('/api/stats/month/<int:year>/<int:month>', methods=['GET'])
def stats_summary_fallback(year, month):
    with app.test_request_context(f"/api/stats/summary?year={year}&month={month}"):
        return stats_summary()

if __name__ == '__main__':
    app.run(debug=True, port=5000)