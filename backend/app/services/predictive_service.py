from datetime import datetime, timedelta
from typing import Any
import httpx

from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.job import Job
from app.models.user import User
from app.models.invoice import JobPartUsed
from app.models.inventory import InventoryItem

try:
    import pandas as pd
    import numpy as np
    from statsmodels.tsa.holtwinters import SimpleExpSmoothing
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False


def _get_rainy_days_forecast(location: str = "Colombo") -> bool:
    """
    Calls Open-Meteo API for the given location in Sri Lanka to check if there is
    significant rainfall expected in the next 14 days.
    """
    locations = {
        "Colombo": ("6.9271", "79.8612"),
        "Kandy": ("7.2906", "80.6337"),
        "Galle": ("6.0367", "80.2170"),
        "Jaffna": ("9.6615", "80.0255"),
        "Gampaha": ("7.0873", "79.9996"),
        "Kurunegala": ("7.4818", "80.3609"),
        "Anuradhapura": ("8.3114", "80.4037")
    }
    
    lat, lon = locations.get(location, locations["Colombo"])
    
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=precipitation_sum&timezone=Asia%2FColombo&forecast_days=14"
        with httpx.Client(timeout=5.0) as client:
            response = client.get(url)
            if response.status_code == 200:
                data = response.json()
                precipitations = data.get("daily", {}).get("precipitation_sum", [])
                
                # Count days with more than 5mm of rain
                rainy_days = sum(1 for p in precipitations if p is not None and p > 5.0)
                
                # If more than 4 days out of 14 are significantly rainy, consider it rainy season
                return rainy_days >= 4
    except Exception:
        pass
        
    return False


def forecast_fault_trends(db: Session, months_back: int = 6, device_model: str = None, location: str = "Colombo") -> list[dict[str, Any]]:
    """
    Analyzes job fault categories over the last N months and forecasts
    the expected percentage change for the next month.
    Optionally filters by device_model and applies weather for a specific location.
    """
    cutoff_date = datetime.now() - timedelta(days=months_back * 30)
    
    query = db.query(
        func.date_trunc('month', Job.received_date).label('month'),
        Job.fault_category,
        func.count(Job.id).label('count')
    ).filter(Job.received_date >= cutoff_date)

    if device_model:
        query = query.filter(Job.device_model == device_model)

    jobs = query.group_by('month', Job.fault_category).order_by('month').all()

    if not jobs or not ML_AVAILABLE:
        return []

    df = pd.DataFrame(jobs, columns=['month', 'fault_category', 'count'])
    df['month'] = pd.to_datetime(df['month'])
    
    pivot = df.pivot(index='month', columns='fault_category', values='count').fillna(0)
    
    is_rainy_season = _get_rainy_days_forecast(location)
    
    trends = []
    for category in pivot.columns:
        series = pivot[category]
        if len(series) < 3:
            continue
            
        try:
            model = SimpleExpSmoothing(series, initialization_method="estimated").fit()
            forecast = model.forecast(1).iloc[0]
            current_avg = series.iloc[-2:].mean() if len(series) >= 2 else series.iloc[-1]
            
            weather_impacted = False
            if is_rainy_season and category == "water_damage":
                forecast = forecast * 1.3
                weather_impacted = True
            
            if current_avg > 0:
                percent_change = ((forecast - current_avg) / current_avg) * 100
            else:
                percent_change = 0
                
            trends.append({
                "fault_category": category,
                "current_avg": round(current_avg, 1),
                "forecasted": round(forecast, 1),
                "trend_percentage": round(percent_change, 1),
                "status": "increasing" if percent_change > 5 else "decreasing" if percent_change < -5 else "stable",
                "weather_impacted": weather_impacted
            })
        except Exception:
            pass
            
    # Sort by highest trend percentage
    return sorted(trends, key=lambda x: x['trend_percentage'], reverse=True)


def forecast_device_trends(db: Session, months_back: int = 6, fault_category: str = None) -> list[dict[str, Any]]:
    """
    Analyzes job volume by device model over the last N months and forecasts
    which devices will have the most repairs next month.
    Optionally filters by fault_category.
    """
    cutoff_date = datetime.now() - timedelta(days=months_back * 30)
    
    query = db.query(
        func.date_trunc('month', Job.received_date).label('month'),
        Job.device_model,
        func.count(Job.id).label('count')
    ).filter(Job.received_date >= cutoff_date).filter(Job.device_model.isnot(None))

    if fault_category:
        query = query.filter(Job.fault_category == fault_category)

    jobs = query.group_by('month', Job.device_model).order_by('month').all()

    if not jobs or not ML_AVAILABLE:
        return []

    df = pd.DataFrame(jobs, columns=['month', 'device_model', 'count'])
    df['month'] = pd.to_datetime(df['month'])
    
    pivot = df.pivot(index='month', columns='device_model', values='count').fillna(0)
    
    trends = []
    for model_name in pivot.columns:
        series = pivot[model_name]
        if len(series) < 3:
            continue
            
        try:
            model = SimpleExpSmoothing(series, initialization_method="estimated").fit()
            forecast = model.forecast(1).iloc[0]
            current_avg = series.iloc[-2:].mean() if len(series) >= 2 else series.iloc[-1]
            
            if current_avg > 0:
                percent_change = ((forecast - current_avg) / current_avg) * 100
            else:
                percent_change = 0
                
            trends.append({
                "device_model": model_name,
                "current_avg": round(current_avg, 1),
                "forecasted": round(forecast, 1),
                "trend_percentage": round(percent_change, 1),
                "status": "increasing" if percent_change > 5 else "decreasing" if percent_change < -5 else "stable"
            })
        except Exception:
            pass
            
    # Sort by highest forecasted volume
    return sorted(trends, key=lambda x: x['forecasted'], reverse=True)


def calculate_technician_scores(db: Session) -> list[dict[str, Any]]:
    """
    Calculates a performance score for each technician.
    """
    completed_jobs = (
        db.query(
            Job.technician_id,
            Job.fault_category,
            Job.actual_fault,
            Job.received_date,
            Job.completed_date,
            Job.diagnostic_time_mins,
            Job.repair_time_mins,
            Job.complexity_level,
            Job.device_model,
            Job.total_diagnostic_seconds,
            Job.total_active_repair_seconds,
            Job.total_away_seconds,
            Job.id
        )
        .filter(Job.status.in_(["completed", "ready_for_pickup", "delivered"]))
        .filter(Job.technician_id.isnot(None))
        .filter(Job.completed_date.isnot(None))
        .all()
    )

    # Fetch reworks to penalize original technicians
    reworks = (
        db.query(Job.rework_of_job_id)
        .filter(Job.rework_of_job_id.isnot(None))
        .all()
    )
    reworked_job_ids = {r[0] for r in reworks}

    if not completed_jobs or not ML_AVAILABLE:
        return []

    df = pd.DataFrame(completed_jobs, columns=['technician_id', 'fault_category', 'actual_fault', 'received', 'completed', 'diag_mins', 'rep_mins', 'complexity', 'device_model', 'total_diagnostic_seconds', 'total_active_repair_seconds', 'total_away_seconds', 'job_id'])
    
    # Calculate duration (if active timer used, prioritize it; else fallback)
    def calc_duration(row):
        active_secs = (row['total_diagnostic_seconds'] or 0) + (row['total_active_repair_seconds'] or 0)
        away_secs = (row['total_away_seconds'] or 0)
        # Apply 50% penalty for away time (it adds to duration, making them look slower)
        total_seconds = active_secs + (away_secs * 0.5)
        
        if active_secs > 0:
            return total_seconds / 3600.0
        if pd.notna(row['diag_mins']) and pd.notna(row['rep_mins']):
            return (row['diag_mins'] + row['rep_mins']) / 60.0
        return (row['completed'] - row['received']).total_seconds() / 3600.0

    df['duration_hours'] = df.apply(calc_duration, axis=1)
    
    # Apply complexity multiplier
    def get_multiplier(comp):
        if comp == 'high': return 0.5
        if comp == 'medium': return 0.8
        return 1.0

    df['duration_hours'] = df['duration_hours'] * df['complexity'].apply(get_multiplier)
    
    df = df[df['duration_hours'] > 0]
    if df.empty:
        return []

    # Dynamic Baselines by Model + Fault
    df['effective_fault'] = df['actual_fault'].fillna(df['fault_category'])
    df['baseline_key'] = df['device_model'] + "_" + df['effective_fault']
    
    # Calculate averages
    general_baselines = df.groupby('effective_fault')['duration_hours'].mean().to_dict()
    specific_baselines = df.groupby('baseline_key')['duration_hours'].mean().to_dict()
    specific_counts = df['baseline_key'].value_counts()

    scores = []
    for tech_id, group in df.groupby('technician_id'):
        total_jobs = len(group)
        if total_jobs < 3:
            continue
            
        efficiency_sum = 0
        rework_penalty = 0
        fault_efficiencies = {}
        for _, row in group.iterrows():
            key = row['baseline_key']
            fault_cat = row['effective_fault']
            if specific_counts.get(key, 0) >= 3:
                baseline = specific_baselines.get(key, 24.0)
            else:
                baseline = general_baselines.get(row['effective_fault'], 24.0)
                
            efficiency = baseline / row['duration_hours'] if row['duration_hours'] > 0 else 1
            efficiency = min(max(efficiency, 0.5), 1.5)
            efficiency_sum += efficiency
            
            # Check if this job resulted in a rework later
            is_rework = row['job_id'] in reworked_job_ids
            if is_rework:
                rework_penalty += 15  # -15 penalty per rework
                
            if fault_cat not in fault_efficiencies:
                fault_efficiencies[fault_cat] = []
            fault_efficiencies[fault_cat].append({
                "eff": efficiency,
                "rework": is_rework
            })
            
        avg_efficiency = efficiency_sum / total_jobs
        score = min(round((avg_efficiency / 1.0) * 80), 100)
        
        # Apply rework penalty
        score = max(score - rework_penalty, 0)
        
        # Calculate Top Specialty
        top_specialty = None
        best_spec_score = -1
        for fault_cat, jobs_list in fault_efficiencies.items():
            if len(jobs_list) >= 2: # Require at least 2 jobs in a category to be a specialty
                cat_avg_eff = sum(j["eff"] for j in jobs_list) / len(jobs_list)
                cat_rework_rate = sum(1 for j in jobs_list if j["rework"]) / len(jobs_list)
                # Score formula: rewards high efficiency and penalizes reworks
                spec_score = cat_avg_eff * (1 - cat_rework_rate)
                if spec_score > best_spec_score and spec_score > 0.8: # Must be reasonably good
                    best_spec_score = spec_score
                    top_specialty = fault_cat
        
        tech = db.query(User).filter(User.id == tech_id).first()
        if tech:
            scores.append({
                "technician_id": str(tech_id),
                "name": tech.name,
                "total_jobs_completed": total_jobs,
                "performance_score": score,
                "top_specialty": top_specialty.replace('_', ' ').title() if top_specialty else None,
                "rating": "Excellent" if score >= 90 else "Good" if score >= 75 else "Needs Improvement"
            })
            
    return sorted(scores, key=lambda x: x['performance_score'], reverse=True)


def forecast_inventory_demand(db: Session, weeks_back: int = 12) -> list[dict[str, Any]]:
    """
    Analyzes parts used over the last N weeks to forecast demand for the next week.
    Only analyzes inventory parts (not donor parts).
    """
    cutoff_date = datetime.now() - timedelta(weeks=weeks_back)
    
    # Query parts used grouped by week and item name
    parts_data = (
        db.query(
            func.date_trunc('week', JobPartUsed.created_at).label('week'),
            InventoryItem.name.label('part_name'),
            func.sum(JobPartUsed.quantity).label('total_qty')
        )
        .join(InventoryItem, JobPartUsed.inventory_item_id == InventoryItem.id)
        .filter(JobPartUsed.part_source == "inventory")
        .filter(JobPartUsed.created_at >= cutoff_date)
        .group_by('week', InventoryItem.name)
        .order_by('week')
        .all()
    )

    if not parts_data or not ML_AVAILABLE:
        return []

    df = pd.DataFrame(parts_data, columns=['week', 'part_name', 'total_qty'])
    df['week'] = pd.to_datetime(df['week'])
    
    pivot = df.pivot(index='week', columns='part_name', values='total_qty').fillna(0)
    
    forecasts = []
    for part in pivot.columns:
        series = pivot[part]
        if len(series) < 3:
            continue
            
        try:
            model = SimpleExpSmoothing(series, initialization_method="estimated").fit()
            forecast_val = model.forecast(1).iloc[0]
            current_avg = series.iloc[-2:].mean() if len(series) >= 2 else series.iloc[-1]
            
            # Predict how many we will need next week, rounded up
            predicted_demand = max(int(np.ceil(forecast_val)), 0)
            
            # Find current stock
            item = db.query(InventoryItem).filter(InventoryItem.name == part).first()
            current_stock = item.quantity if item else 0
            
            # Generate a Smart Alert if predicted demand > current stock
            status = "critical" if predicted_demand > current_stock else "warning" if predicted_demand >= (current_stock * 0.8) else "ok"
            
            if predicted_demand > 0 or current_avg > 0:
                forecasts.append({
                    "part_name": part,
                    "current_stock": current_stock,
                    "avg_weekly_usage": round(current_avg, 1),
                    "predicted_demand": predicted_demand,
                    "status": status,
                    "restock_recommended": max(predicted_demand - current_stock, 0)
                })
        except Exception:
            pass
            
    # Sort by items that need restocking most urgently
    return sorted(forecasts, key=lambda x: (x['status'] == 'ok', -x['restock_recommended'], -x['predicted_demand']))
