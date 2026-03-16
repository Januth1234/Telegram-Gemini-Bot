
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
// const Tesseract = require("tesseract.js"); // Uncomment when deploying with 1GB+ memory

admin.initializeApp();
const db = admin.firestore();

// Config: firebase functions:config:set orina.owner_uid="..." orina.secret_code="#710273"
const OWNER_UID = functions.config().orina?.owner_uid || process.env.ORIN_OWNER_UID;
const SECRET_CODE = functions.config().orina?.secret_code || "#710273";

async function logAudit(action, actorUid, details) {
  await db.collection("audit_logs").add({
    action,
    actorUid,
    details,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// --- 1. Auth & Roles ---

function requireAppCheck(context) {
  if (!context.app) {
    throw new functions.https.HttpsError("failed-precondition", "App Check failed.");
  }
}

exports.createPendingSignup = functions.https.onCall(async (data, context) => {
  requireAppCheck(context);
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required.");

  const { email, reason } = data;
  const uid = context.auth.uid;
  const codeDetected = reason.includes(SECRET_CODE);
  
  await db.collection("pending_signups").doc(uid).set({
    uid,
    email,
    reason,
    codeDetected,
    requestedRole: codeDetected ? "devops" : "visitor",
    status: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await logAudit("SIGNUP_REQUEST", uid, { email, codeDetected });
  return { success: true };
});

exports.approveUser = functions.https.onCall(async (data, context) => {
  requireAppCheck(context);
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required.");
  const isOwnerUid = context.auth.uid === OWNER_UID;
  if (!isOwnerUid) {
    const caller = await admin.auth().getUser(context.auth.uid);
    if (caller.customClaims?.role !== "owner") {
      throw new functions.https.HttpsError("permission-denied", "Owner access required.");
    }
  }

  const { targetUid, role, approved } = data;
  const validRoles = ["visitor", "training", "devops", "owner"];
  if (!validRoles.includes(role)) throw new functions.https.HttpsError("invalid-argument", "Invalid role");

  // 1. Set Custom Claims (The real security)
  await admin.auth().setCustomUserClaims(targetUid, { role });

  // 2. Update DB Doc (For UI)
  await db.collection("users").doc(targetUid).set({
    role,
    approved,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // 3. Update Request Status
  await db.collection("pending_signups").doc(targetUid).update({ status: approved ? "approved" : "rejected" });

  await logAudit("APPROVE_USER", context.auth.uid, { targetUid, role });
  return { success: true };
});

// --- 2. DevOps: API Keys ---

exports.generateApiKey = functions.https.onCall(async (data, context) => {
  const role = context.auth.token.role;
  if (!["devops", "owner"].includes(role)) {
    throw new functions.https.HttpsError("permission-denied", "DevOps role required.");
  }

  const rawKey = "orin_" + crypto.randomBytes(24).toString("hex");
  const hash = crypto.createHash("sha256").update(rawKey).digest("hex");

  await db.collection("api_keys").add({
    hash,
    note: data.note || "Generated Key",
    createdBy: context.auth.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    enabled: true
  });

  await logAudit("GENERATE_KEY", context.auth.uid, { note: data.note });
  // Return key only once!
  return { apiKey: rawKey };
});

// --- 3. Training: OCR Process ---

exports.ocrProcess = functions.runWith({ memory: '1GB', timeoutSeconds: 300 }).https.onCall(async (data, context) => {
  requireAppCheck(context);
  const role = context.auth?.token?.role;
  if (!["training", "devops", "owner"].includes(role)) {
    throw new functions.https.HttpsError("permission-denied", "Training role required.");
  }

  const { imageUrl, lang = 'eng' } = data;
  
  // Mocking Tesseract for prototype stability without heavy node_modules in snippets
  // In production, uncomment require('tesseract.js') and the code below
  
  /* 
  const worker = await Tesseract.createWorker(lang === 'si' ? 'sin' : 'eng');
  const ret = await worker.recognize(imageUrl);
  const text = ret.data.text;
  await worker.terminate();
  */

  // Simulated Result
  const mockText = `
  1. What is the derivative of sin(x)?
     (i) cos(x)  (ii) -cos(x)
  
  2. Define 'Momentum'.
  `;

  await logAudit("OCR_PROCESS", context.auth.uid, { imageUrl });

  return {
    rawText: mockText,
    blocks: [
      { id: 1, text: "What is the derivative of sin(x)?", prob: 0.98 },
      { id: 2, text: "Define 'Momentum'.", prob: 0.95 }
    ]
  };
});
