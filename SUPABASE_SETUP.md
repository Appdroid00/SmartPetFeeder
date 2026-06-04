# Supabase setup

Your app now uses the table layout from your Supabase screenshot.

1. Open Project Settings > API in Supabase.
2. Copy the Project URL and anon public key.
3. Paste them into `supabase-config.js`.
4. Make sure these starter records exist:
   - `devices.id = FEEDER001`
   - `schedules.id = 1`
   - `schedules.id = 2`
   - `schedules.id = 3`
5. If row level security is enabled, run the policy section in `supabase-schema.sql`.
6. Open Database > Replication and enable realtime for:
   - `devices`
   - `schedules`
   - `feed_logs`

The web app writes feed requests to `devices.feed_now`.
Your device code should watch that value, dispense food when it becomes `true`,
then set it back to `false`.

The web app reads status from `devices.status`.
Your device code should update `devices.status` to `ONLINE` or `OFFLINE`, and
can update `devices.last_seen` whenever it checks in.

The three schedule inputs use rows `1`, `2`, and `3` in the `schedules` table.

## Arduino sketch

Use `SmartPetFeeder_Supabase.ino` for the ESP8266.

Install these Arduino libraries:

- `ArduinoJson`
- `RTClib`
- `Servo`
- ESP8266 board package

Paste the same Supabase Project URL and anon public key into the sketch:

```cpp
const char* SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const char* SUPABASE_ANON_KEY = "YOUR-SUPABASE-ANON-KEY";
```

The ESP8266 polls Supabase every few seconds. When `devices.feed_now` is `true`,
it feeds once, inserts a row into `feed_logs`, then resets `feed_now` to `false`.

For scheduled feeding, it reads rows `1`, `2`, and `3` from `schedules`, compares
`feed_time` with the RTC time, feeds when matched, then marks the schedule row as
`Done` and `completed = true`.
