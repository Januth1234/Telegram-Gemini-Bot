
# Orin AI - Exam Assistant & Admin System

## 1. Setup
- Ensure Firebase CLI is installed: `npm install -g firebase-tools`
- Login: `firebase login`
- Initialize functions if missing: `firebase init functions`

## 2. Configuration
Set the owner UID and secret code:
```bash
firebase functions:config:set orina.owner_uid="<YOUR_ADMIN_UID>"
firebase functions:config:set orina.secret_code="#710273"
```

## 3. Deploy
Deploy Firestore Rules and Cloud Functions:
```bash
firebase deploy --only functions,firestore
```

## 4. Admin Access
1. Sign up on the frontend.
2. Enter the secret code `#710273` in the reason field.
3. Use the Owner account to approve the request via the Admin Portal.
