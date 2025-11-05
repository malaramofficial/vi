# **App Name**: Vidyut Sahayak

## Core Features:

- Timer Management: Allows users to set a timer for a specific duration which auto-pauses and resumes based on power status.
- Realtime Power Detection: Detects the presence or absence of power, via the device's charging status.
- Automated Timer Control: Automatically pauses the timer when power is lost and resumes when power is restored.
- Alarm System: Triggers a loud alarm with custom sound options and flashing light notifications upon timer completion.
- Notification Dispatch: Delivers real-time notifications to users on power status changes ('Power outage detected' and 'Power restored')
- User data persistence: Store and synchronize user timer data and settings in Firebase Realtime Database.
- Power Event Log Analysis: Use generative AI to analyze trends in power events, summarizing data and potentially forecasting future outages as a tool.  Provide insights via push notifications to the user.

## Style Guidelines:

- Primary color: Saturated electric blue (#7DF9FF) for energy and alertness.
- Background color: Light desaturated blue (#E0FFFF) for a calm yet modern backdrop.
- Accent color: Bright analogous green (#7FFF7D) for positive indicators (power on, timer complete).
- Body and headline font: 'Inter' for a modern, objective feel. 
- Use line icons for power, time, and notifications.
- Clean, intuitive layout with clear visual cues for power status.
- Subtle animations for timer start/stop and power status changes.