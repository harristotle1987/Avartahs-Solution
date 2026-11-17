const draft = "Subject: Unlock the Full Potential\n\nDear Test Business Team,\n...";
let subject = "Elevating Business";
let body = draft;
const subjectMatch = draft.match(/^Subject:\s*(.*)/i);
if (subjectMatch) {
  subject = subjectMatch[1];
  body = draft.replace(/^Subject:\s*.*\n*/i, '').trim();
}
console.log(subject);
console.log(body);
