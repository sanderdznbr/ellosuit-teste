const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard/InPersonMeeting.tsx', 'utf8');

// 1. Fix duration_seconds and add meeting_recordings insert
const saveRecordingMatch = content.match(/const meetingData, error: dbError \} = await supabase\s+\.from\('in_person_meetings'\)\s+\.insert\(\{[\s\S]+?\}\)\s+\.select\(\)\s+\.single\(\);/);
if (saveRecordingMatch) {
    let original = saveRecordingMatch[0];
    let updated = original.replace(/duration_seconds: Math\.floor\(audioChunksRef\.current\.length\)/, 'duration_seconds: recordingDuration');
    updated += "\n\n      // Also save to meeting_recordings to show in \"Recent Meetings\"\n      await supabase\n        .from('meeting_recordings')\n        .insert({\n          title: `[Presencial] ${meetingTitle}`,\n          file_url: fileName,\n          transcript: whisperTranscript,\n          created_by: user.id,\n          company_id: companyData.company_id,\n          duration_seconds: recordingDuration,\n          meeting_type: 'in_person'\n        });";
    content = content.replace(original, updated);
}

// 2. Fix catch block in processSpeakerDiarization
const catchBlockMatch = content.match(/\} catch \(error\) \{[\s\S]+?setTranscript\(fallbackTranscript\);/);
if (catchBlockMatch) {
    let original = catchBlockMatch[0];
    let updated = original + "\n      setShowDownloadOptions(true);";
    content = content.replace(original, updated);
}

// 3. Remove professional-deteriorating toasts
content = content.replace(/toast\(\{\s+title: "Download TXT Iniciado"[\s\S]+?\}\);/g, '');
content = content.replace(/toast\(\{\s+title: "Download PDF Iniciado"[\s\S]+?\}\);/g, '');
content = content.replace(/toast\(\{\s+title: "Nomes Adicionados!"[\s\S]+?\}\);/g, '');

fs.writeFileSync('src/components/Dashboard/InPersonMeeting.tsx', content);
