import axios from 'axios';

const RFID_URL = 'http://localhost:8000';

async function runRfidE2E() {
  console.log('Testing RFID Middleware on port 8000...\n');

  // 1. Devices status
  const devRes = await axios.get(`${RFID_URL}/devices/status`);
  console.log('1. Devices status: ALL_ONLINE =', devRes.data.all_online);

  // 2. Staff Station Scan
  const staffScanRes = await axios.post(`${RFID_URL}/devices/staff-station/scan`, {
    device_id: 'DEV-SS-001',
    epc_list: ['3034257BF4000B4000000001'],
  });
  console.log('2. Staff station scan: Detected =', staffScanRes.data.tags_detected, 'Known =', staffScanRes.data.tags[0]?.is_known);

  // 3. Handheld scan
  const handheldRes = await axios.post(`${RFID_URL}/devices/handheld/scan`, {
    device_id: 'DEV-HH-001',
    target_shelf: 'STACK-B/AISLE-04/SHELF-02',
    tag_count: 5,
  });
  console.log('3. Handheld sweep: Scanned =', handheldRes.data.scanned_count, 'Verified =', handheldRes.data.verified_count, 'Misplaced =', handheldRes.data.misplaced_count);

  // 4. Security Gate Event (Authorized transit)
  const gateAuthRes = await axios.post(`${RFID_URL}/devices/security-gate/event`, {
    device_id: 'DEV-SG-001',
    rfid_epc: '3034257BF4000B4000000001',
    force_alarm: false,
  });
  console.log('4. Gate event (Authorized): Alarm =', gateAuthRes.data.alarm_triggered, 'Buffered =', gateAuthRes.data.buffered_offline);

  // 4b. Security Gate Event (Unauthorized alarm)
  const gateAlarmRes = await axios.post(`${RFID_URL}/devices/security-gate/event`, {
    device_id: 'DEV-SG-001',
    rfid_epc: '3034257BF4000B4000000002',
    force_alarm: true,
  });
  console.log('4b. Gate event (Unauthorized ALARM): Alarm =', gateAlarmRes.data.alarm_triggered, 'Reason =', gateAlarmRes.data.alarm_reason, 'CCTV =', gateAlarmRes.data.cctv_timestamp_ref);

  // 5. Query Events
  const eventsRes = await axios.get(`${RFID_URL}/events`);
  console.log('5. Total events in SQLite buffer:', eventsRes.data.total);

  // 6. Sync events
  const syncRes = await axios.post(`${RFID_URL}/events/sync`);
  console.log('6. Sync result:', syncRes.data);
}

runRfidE2E().catch(console.error);
