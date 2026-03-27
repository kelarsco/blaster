# Railway Environment Variables Update

## New Neon Database Connection String
```
DATABASE_URL=postgresql://neondb_owner:npg_41GxSYyAoTZF@ep-purple-sun-amvcs0kp-pooler.c-5.us-east-1.aws.neon.tech/wiblaster?sslmode=require&channel_binding=require
```

## Steps to Update Railway:
1. Go to your Railway dashboard
2. Select the blaster-production project
3. Go to "Variables" tab
4. Update DATABASE_URL with the new Neon connection string above
5. Click "Deploy" to restart the service with new database
6. Monitor logs to see "Neon DB connected and schema ready"

## All Tables Created Successfully:
✅ users
✅ scans  
✅ scan_results
✅ senders
✅ sender_groups
✅ sender_group_members
✅ campaign_presets
✅ campaigns
✅ campaign_sends
✅ campaign_pending_sends
✅ store_notes
✅ activity_logs
✅ invites
✅ subscriptions
✅ user_extra_credit
✅ plans (with all pricing data)

## Migration Complete!
Your new Neon database is ready with all tables and data.
