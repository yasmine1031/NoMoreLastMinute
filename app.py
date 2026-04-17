import os
from flask import Flask, request, jsonify 
from flask_sqlalchemy import SQLAlchemy 
from werkzeug.security import generate_password_hash, check_password_hash 
from flask_cors import CORS 

app = Flask(__name__)
CORS(app) 

basedir = os.path.abspath(os.path.dirname(__file__)) 
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'nmlm_users.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app) 
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fullname = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)

with app.app_context():
    db.create_all()
    print("Database initialized at:", app.config['SQLALCHEMY_DATABASE_URI'])


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
        password=hashed_pw
    )
    
    try:
        db.session.add(new_user)
        db.session.commit()
        print(f"Signup success: User {new_user.fullname} added to DB.")
        return jsonify({"message": "Account created successfully!"}), 201
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