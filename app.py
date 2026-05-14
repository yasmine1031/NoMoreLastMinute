import os
import jwt
from datetime import datetime, timedelta
from flask import Flask, request, jsonify 
from flask_sqlalchemy import SQLAlchemy 
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS 
from flask_mail import Mail, Message 

app = Flask(__name__)
CORS(app) 

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

with app.app_context():
    db.create_all()#
    print("Database initialized at:", app.config['SQLALCHEMY_DATABASE_URI'])

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


verification_codes = {}

@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    """验证OTP验证码"""
    data = request.get_json()
    code = data.get('code', '')
    
    for email, otp_data in verification_codes.items():
        if otp_data['code'] == code:
            if datetime.utcnow() > otp_data['expires']:
                del verification_codes[email]
                return jsonify({"message": "Verification code expired"}), 400
            
            user = User.query.filter_by(email=email).first()
            if user:
                user.is_verified = True
                db.session.commit()
                del verification_codes[email]
                return jsonify({"message": "Email verified successfully!"}), 200
    
    return jsonify({"message": "Invalid verification code"}), 400


@app.route('/api/resend-otp', methods=['POST'])
def resend_otp():
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({"message": "Email is required"}), 400
    
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    import random
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
        print(f"OTP sent to {email}: {otp}")
        return jsonify({"message": "Verification code sent"}), 200
    except Exception as e:
        print(f"Error sending OTP: {str(e)}")
        return jsonify({"message": "Failed to send verification code"}), 500


@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    print(f"--- Signup Attempt: {data.get('email')} ---") 
    
    if User.query.filter_by(email=data['email']).first():
        print("Signup failed: Email already exists.")
        return jsonify({"message": "Email already registered"}), 400
    
    hashed_pw = generate_password_hash(data['password'])
    
    new_user = User(
        fullname=data.get('fullname'),
        email=data['email'],
        password=hashed_pw,
        is_verified=False
    )
    
    try:
        db.session.add(new_user)
        db.session.commit()
        print(f"Signup success: User {new_user.fullname} added to DB.")
        
        import random
        otp = str(random.randint(100000, 999999))
        verification_codes[data['email']] = {
            'code': otp,
            'expires': datetime.utcnow() + timedelta(minutes=10)
        }
        
        try:
            msg = Message(
                'Your No More Last Minute Verification Code',
                recipients=[data['email']]
            )
            msg.body = f'''Hi {new_user.fullname},

Welcome to No More Last Minute!

Your verification code is: {otp}

This code will expire in 10 minutes.

If you didn't create an account, please ignore this email.

Best regards,
No More Last Minute Team'''
            mail.send(msg)
            print(f"OTP sent to {data['email']}: {otp}")
        except Exception as e:
            print(f"Error sending OTP: {str(e)}")
        
        return jsonify({"message": "Account created! Please check your email to verify your account."}), 201
    except Exception as e:
        print(f"DB Error: {str(e)}")
        return jsonify({"message": "Database error"}), 500

@app.route('/api/signin', methods=['POST'])
def signin():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    print(f"--- Signin Attempt: {email} ---") 
    
    user = User.query.filter_by(email=email).first()
    
    if user:
        print(f"User found: {user.fullname}, checking password...")
        if check_password_hash(user.password, password):
            print("Password matches! Access granted.")
            return jsonify({
                "message": "Login successful!",
                "user": {"fullname": user.fullname, "email": user.email}
            }), 200
        else:
            print("Password mismatch!")
    else:
        print("User not found in database.")
    
    return jsonify({"message": "Invalid email or password"}), 401

if __name__ == '__main__':
    app.run(debug=True, port=5000)