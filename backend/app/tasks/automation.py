import asyncio
from datetime import datetime, timedelta, timezone
from app.core.database import SessionLocal
from app.models.job import Job, JobStatusHistory
from app.models.donor import DonorDevice
from app.models.user import User
from app.services.notification_service import notify_unclaimed, notify_admin_unclaimed, notify_final_warning

def process_unclaimed_jobs():
    db = SessionLocal()
    try:
        # Get an admin user to attribute the automated change to
        system_admin = db.query(User).filter(User.role == "admin").first()
        if not system_admin:
            print("Auto-Unclaim skipped: No admin user found to attribute changes.")
            return
            
        # Thresholds (using short limits for testing instead of 90 days / 83 days)
        warning_threshold = datetime.now(timezone.utc) - timedelta(minutes=1)
        unclaim_threshold = datetime.now(timezone.utc) - timedelta(minutes=2)
        
        # Find jobs that are currently ready_for_pickup
        jobs = db.query(Job).filter(Job.status == "ready_for_pickup").all()
        
        for job in jobs:
            # Find the most recent 'ready_for_pickup' status entry
            history = (
                db.query(JobStatusHistory)
                .filter(JobStatusHistory.job_id == job.id, JobStatusHistory.status == "ready_for_pickup")
                .order_by(JobStatusHistory.created_at.desc())
                .first()
            )
            
            if history:
                # Tier 2: Unclaim if passed unclaim_threshold
                if history.created_at < unclaim_threshold:
                    print(f"Auto-Unclaiming job {job.job_id}")
                    job.status = "unclaimed"
                    job.admin_alert = "Auto-converted to Donor Device due to waiting period."
                    
                    new_history = JobStatusHistory(
                        job_id=job.id,
                        status="unclaimed",
                        changed_by=system_admin.id,
                        notes="Automated transition: Unclaimed after grace period in ready_for_pickup"
                    )
                    db.add(new_history)
                    
                    donor = DonorDevice(
                        brand=job.device_brand,
                        model=job.device_model,
                        imei=job.device_imei,
                        condition="fair",
                        source="unclaimed_job",
                        source_job_id=job.id,
                        status="available",
                        assigned_technician_id=job.technician_id
                    )
                    db.add(donor)
                    db.commit()
                    
                    # Send notifications
                    try:
                        notify_unclaimed(job.id)
                        notify_admin_unclaimed(job.id)
                    except Exception as e:
                        print(f"Failed to send unclaimed notifications for {job.job_id}: {e}")
                
                # Tier 1: Warning if passed warning_threshold and warning not sent
                elif history.created_at < warning_threshold and not job.final_warning_sent:
                    print(f"Sending Final Warning for job {job.job_id}")
                    job.final_warning_sent = True
                    db.commit()
                    
                    try:
                        notify_final_warning(job.id)
                    except Exception as e:
                        print(f"Failed to send final warning for {job.job_id}: {e}")
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
        await asyncio.sleep(60) # Sleep for 1 minute for testing
