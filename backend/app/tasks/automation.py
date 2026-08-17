import asyncio
from datetime import datetime, timedelta, timezone
from app.core.database import SessionLocal
from app.models.job import Job, JobStatusHistory
from app.models.notification import AdminCallTask, SalvageAssessment
from app.models.user import User
from app.services.notification_service import notify_unclaimed, notify_final_warning
# We will use a generic helper for reminders
from app.services.notification_service import notify_job_reminder

def _create_admin_call_task(db, job_id, message):
    task = AdminCallTask(job_id=job_id, message=message)
    db.add(task)
    db.commit()

def process_unclaimed_jobs():
    db = SessionLocal()
    try:
        system_admin = db.query(User).filter(User.role == "admin").first()
        if not system_admin:
            return
            
        now = datetime.now(timezone.utc)
        t_83 = now - timedelta(minutes=1)
        t_90 = now - timedelta(minutes=2)
        t_425 = now - timedelta(minutes=3)
        t_455 = now - timedelta(minutes=4)
        t_460 = now - timedelta(minutes=5)
        
        ready_jobs = db.query(Job).filter(Job.status == "ready_for_pickup").all()
        for job in ready_jobs:
            if job.salvage_delayed_until:
                if job.salvage_delayed_until > now:
                    continue
                else:
                    print(f"Auto-Unclaiming delayed job {job.job_id}")
                    job.status = "unclaimed"
                    job.admin_alert = f"Extended time expired on {job.salvage_delayed_until.strftime('%Y-%m-%d')}. Transferred to Salvage."
                    
                    new_history = JobStatusHistory(
                        job_id=job.id,
                        status="unclaimed",
                        changed_by=system_admin.id,
                        notes="Automated transition: Extended time expired"
                    )
                    db.add(new_history)
                    
                    salvage = SalvageAssessment(
                        job_id=job.id,
                        status="pending"
                    )
                    db.add(salvage)
                    db.commit()
                    continue

            history = (
                db.query(JobStatusHistory)
                .filter(JobStatusHistory.job_id == job.id, JobStatusHistory.status == "ready_for_pickup")
                .order_by(JobStatusHistory.created_at.desc())
                .first()
            )
            
            if not history:
                continue
                
            ready_at = history.created_at

            if ready_at < t_460:
                print(f"Auto-Unclaiming job {job.job_id}")
                job.status = "unclaimed"
                job.admin_alert = "15 month period expired. Automatically transferred to Salvage."
                
                new_history = JobStatusHistory(
                    job_id=job.id,
                    status="unclaimed",
                    changed_by=system_admin.id,
                    notes="Automated transition: Unclaimed after 15 months in ready_for_pickup"
                )
                db.add(new_history)
                
                # Auto-create Salvage Assessment
                salvage = SalvageAssessment(
                    job_id=job.id,
                    status="pending"
                )
                db.add(salvage)
                db.commit()
                continue
                
            if ready_at < t_455 and not job.final_warning_sent:
                job.final_warning_sent = True
                db.commit()
                notify_final_warning(job.id)
                _create_admin_call_task(db, job.id, "Final Warning (Month 15): Call customer immediately")
                continue

            if ready_at < t_425 and not job.reminder_425_sent:
                job.reminder_425_sent = True
                db.commit()
                notify_job_reminder(job.id, "Month 14 Reminder: Your device has been awaiting pickup for 14 months.")
                _create_admin_call_task(db, job.id, "Month 14 Reminder: Call customer to remind about pickup.")
                continue

            if ready_at < t_90 and not job.reminder_90_sent:
                job.reminder_90_sent = True
                db.commit()
                notify_job_reminder(job.id, "3 Month Warning: Your device has been awaiting pickup for 3 months. Liability is now released per the bill terms.")
                _create_admin_call_task(db, job.id, "3 Month Warning: Call customer to notify liability release.")
                continue

            if ready_at < t_83 and not job.reminder_83_sent:
                job.reminder_83_sent = True
                db.commit()
                notify_job_reminder(job.id, "Reminder: Your device has been awaiting pickup for nearly 3 months.")
                _create_admin_call_task(db, job.id, "Day 83 Reminder: Call customer before 3 month liability release.")
                continue

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

async def background_task_runner():
    """Loops indefinitely, running automated tasks every 60 seconds."""
    while True:
        process_unclaimed_jobs()
        await asyncio.sleep(60)

