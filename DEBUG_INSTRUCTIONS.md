# Agent-Lock Debug Instructions

## Problem: User Intent Not Captured

I've added comprehensive debugging to the plugin to identify why the user intent isn't being captured.

## What I Changed:

1. **Enhanced Debug Logging**: Added detailed console logs to track:
   - Available API methods in OpenClaw
   - Which event hooks are successfully registered
   - What data is received by each hook
   - Deep-search results for user messages

2. **Extended Event Hooks**: Added more event names to test:
   - `session_start`, `user_prompt`, `chat`, `conversation`
   - `new_message`, `receive_message`, `message_received`

3. **Better Error Handling**: Fixed TypeScript errors and added proper error logging

## Next Steps:

1. **Start the backend**:
   ```powershell
   cd c:\Nueva-carpeta\agent-lock
   python agent-lock.py start
   ```

2. **Restart OpenClaw Gateway** (important!):
   ```powershell
   openclaw gateway restart
   ```

3. **Test with a simple command**:
   - Send a message like "list files in current directory"
   - Watch the console output for debug information

## What to Look For:

The debug logs will show:
- 🔍 Available API methods
- ✅/❌ Which hooks are registered
- 📨/📥 When events are triggered
- 🔍 Deep-search results
- 🧠 Intent cache status
- 💭 Final captured intent

## Expected Behavior:

You should see logs like:
```
[Agent-Lock] 🔍 Available API methods: [...]
[Agent-Lock] ✅ api.onMessage OK
[Agent-Lock] 🎯 Testing 16 event hooks...
[Agent-Lock] 📨 onMessage triggered: {...}
[Agent-Lock] 📝 Intent captured: "your message here"
```

If no events are triggered, we'll know the issue is with OpenClaw's event system.
If events are triggered but no intent is captured, we'll see what data structure OpenClaw is actually sending.

## Troubleshooting:

- **No events triggered**: OpenClaw version may not support these hooks
- **Events but no intent**: Data structure different than expected
- **Intent captured but not passed**: Backend communication issue

Run the test and share the console output - I'll analyze it and fix the specific issue.
