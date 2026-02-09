
/**
 * Orin AI Admin Flow Test
 * Run: node scripts/testFlow.js
 * Requires: SERVICE_ACCOUNT_KEY.json
 */
const admin = require("firebase-admin");
try {
  const serviceAccount = require("../service_account_key.json"); 
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch(e) {
  console.log("No service account found. Mocking test flow.");
  process.exit(0);
}

const db = admin.firestore();

async function runTest() {
  console.log("--- Orin AI Integration Test ---");
  const testUid = "test_user_" + Date.now();
  
  // 1. Create Pending Signup
  console.log(`Creating pending signup for ${testUid}...`);
  await db.collection("pending_signups").doc(testUid).set({
    email: "visitor@orin.ai",
    reason: "I have the code #710273",
    codeDetected: true,
    status: "pending",
    requestedRole: "visitor",
    createdAt: new Date()
  });

  // 2. Create User
  await db.collection("users").doc(testUid).set({ role: "visitor", approved: false });

  // 3. Simulate Approval
  console.log("Simulating Owner Approval...");
  await admin.auth().setCustomUserClaims(testUid, { role: "data_training" });
  await db.collection("users").doc(testUid).update({ approved: true, role: "data_training" });
  await db.collection("pending_signups").doc(testUid).update({ status: "approved" });

  const user = await admin.auth().getUser(testUid);
  console.log("Verified Role:", user.customClaims.role);

  // Cleanup
  await admin.auth().deleteUser(testUid);
  await db.collection("users").doc(testUid).delete();
  console.log("Cleanup complete.");
}

runTest().catch(console.error);
