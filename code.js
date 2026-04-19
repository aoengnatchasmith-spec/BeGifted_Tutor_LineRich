// ============================================================
// BG — Cancel Class Web App (v3 — email auth via Wise API)
// ============================================================

var CONFIG = {
  baseUrl:     'https://api.wiseapp.live',
  userId:      '69366668c05630afe5d8a2a4',
  apiKey:      '30bd95e756eba2b8e6d13577c2761fc6',
  instituteId: '696e1f4d90102225641cc413',
  namespace:   'begifted-education',
  daysAhead:   7,   // Wise API limits availability range to 7 days
};

var REQUESTS_SHEET = 'CancelRequests';


// ─── Web App entry ─────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Cancel Class — BG')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


// ─── Setup sheet ───────────────────────────────────────────
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(REQUESTS_SHEET) || ss.insertSheet(REQUESTS_SHEET);
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      'timestamp', 'line_id', 'tutor_name', 'tutor_email',
      'session_id', 'session_datetime', 'class_name', 'student_name', 'reason',
    ]);
    sh.getRange('A1:I1').setFontWeight('bold').setBackground('#dcfce7');
    sh.setFrozenRows(1);
  }
  SpreadsheetApp.getUi().alert('Sheet created successfully');
}


// ─── Wise API wrapper ──────────────────────────────────────
function wiseFetch_(path) {
  var authToken = Utilities.base64Encode(CONFIG.userId + ':' + CONFIG.apiKey);
  var response = UrlFetchApp.fetch(CONFIG.baseUrl + path, {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      'Authorization':    'Basic ' + authToken,
      'user-agent':       'VendorIntegrations/' + CONFIG.namespace,
      'x-api-key':        CONFIG.apiKey,
      'x-wise-namespace': CONFIG.namespace,
      'Content-Type':     'application/json',
    },
  });
  var code = response.getResponseCode();
  var text = response.getContentText();
  if (code >= 400) throw new Error('Wise API ' + code + ': ' + text.substring(0, 200));
  return JSON.parse(text);
}


// ─── Find teacher by email (via Wise API) ──────────────────
function findTeacherByEmail_(email) {
  var path = '/institutes/' + CONFIG.instituteId + '/teachers';
  var res = wiseFetch_(path);
  var teachers = (res.data && res.data.teachers) || [];
  var target = String(email).trim().toLowerCase();

  for (var i = 0; i < teachers.length; i++) {
    var t = teachers[i];
    var u = t.userId || {};
    var candidates = [
      u.email,
      t.email,
      (u.identities || []).filter(function(id) { return id.provider === 'FIREBASE_ID'; })
        .map(function(id) { return id.providerMetadata && id.providerMetadata.email; })[0],
    ];
    for (var j = 0; j < candidates.length; j++) {
      if (candidates[j] && String(candidates[j]).trim().toLowerCase() === target) {
        return {
          teacherId: u._id || t._id,
          name:      u.name || t.name || '',
          email:     candidates[j],
        };
      }
    }
  }
  return null;
}


// ─── CLIENT: validate email ────────────────────────────────
function validateEmail(email) {
  try {
    if (!email || !email.includes('@')) {
      return { ok: false, error: 'INVALID_EMAIL' };
    }
    var teacher = findTeacherByEmail_(email);
    if (!teacher) return { ok: false, error: 'NOT_FOUND' };
    return { ok: true, teacher: teacher };
  } catch (err) {
    return { ok: false, error: 'API_ERROR', message: String(err) };
  }
}


// ─── CLIENT: get sessions for a teacher ────────────────────
function getSessions(teacherId) {
  try {
    var now = new Date();
    var end = new Date(now.getTime() + CONFIG.daysAhead * 86400000);
    var path = '/institutes/' + CONFIG.instituteId +
               '/teachers/' + teacherId + '/availability' +
               '?startTime=' + encodeURIComponent(now.toISOString()) +
               '&endTime='   + encodeURIComponent(end.toISOString());

    var res = wiseFetch_(path);
    var sessions = (res.data && res.data.sessions) || [];

    var mapped = sessions.map(function(s) {
      return {
        id:        s._id,
        startTime: s.scheduledStartTime,
        endTime:   s.scheduledEndTime,
        className: (s.classId && s.classId.name) || '(unnamed)',
        students:  (s.participants || []).map(function(p) { return p.name || '—'; }),
      };
    });

    return { ok: true, sessions: mapped };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}


// ─── CLIENT: submit cancel request ─────────────────────────
function submitCancelRequest(payload) {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REQUESTS_SHEET);
    if (!sh) throw new Error('Sheet not found. Run setupSheets() first.');
    sh.appendRow([
      new Date(),
      payload.lineId          || '',
      payload.tutorName       || '',
      payload.email           || '',
      payload.sessionId       || '',
      payload.sessionDatetime || '',
      payload.className       || '',
      payload.studentName     || '',
      payload.reason          || '',
    ]);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}


// ─── Debug helpers ─────────────────────────────────────────
function debug_listTeachers() {
  var res = wiseFetch_('/institutes/' + CONFIG.instituteId + '/teachers');
  Logger.log(JSON.stringify(res).substring(0, 2000));
}

function debug_validateEmail() {
  var result = validateEmail('anavat10@gmail.com');
  Logger.log(JSON.stringify(result, null, 2));
}