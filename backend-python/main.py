from fastapi import FastAPI, HTTPException
from typing import Any, Dict
import os
import io
import base64
import numpy as np
import pandas as pd
import soundfile as sf
from pedalboard import Pedalboard, Reverb, PitchShift, Gain, Delay, Chorus
from pedalboard.io import AudioFile

app = FastAPI()
AUDIO_DIR = "audio_files"

@app.post("/process-sleep-data")
async def process_sleep_data(data: Dict[str, Any]):
    """
    Applies a specific audio effect based on the day of the week.
    """
    print("--- Received data for Day-based Mixing ---")
    
    sound_file = data.get("sound_file")
    day_of_week = data.get("day_of_week")
    mixing_pattern = data.get("mixing_pattern") # "A", "B", or "C"

    if sound_file is None:
        raise HTTPException(status_code=400, detail="Sound file is required.")

    audio_filepath = os.path.join(AUDIO_DIR, sound_file)
    if not os.path.exists(audio_filepath):
        raise HTTPException(status_code=500, detail=f"Audio file not found: {audio_filepath}")

    try:
        # Use Pedalboard's AudioFile to read (supports MP3, WAV, etc.)
        with AudioFile(audio_filepath) as f:
            audio = f.read(f.frames)
            sample_rate = f.samplerate

        # Pedalboard returns (channels, samples)
        if audio.ndim > 1:
            audio = np.mean(audio, axis=0) # Convert to mono (axis 0 is channels)
            
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)

        effect_name = ""
        processed_audio = audio

        # --- Apply effect based on mixing_pattern OR day of the week ---
        
        # Logic for Mixing Patterns
        if mixing_pattern:
            # Support composite patterns like "A+B"
            patterns = mixing_pattern.split('+')
            print(f"Applying mixing patterns: {patterns}")
            
            for pat in patterns:
                pat = pat.strip()
                if not pat: continue

                if pat == "A": # Tremolo
                    print(f"  - Applying Tremolo (A)")
                    tremolo_rate_hz = 6.0
                    tremolo_depth = 0.3
                    
                    # Recalculate LFO based on current audio length
                    current_len = len(processed_audio)
                    lfo_time = np.arange(current_len) / sample_rate
                    
                    # Handle 2D (stereo) or 1D (mono) audio
                    if processed_audio.ndim == 2:
                         lfo = (1 - tremolo_depth) + tremolo_depth * np.sin(2 * np.pi * tremolo_rate_hz * lfo_time)
                         # Apply to both columns
                         processed_audio[:, 0] *= lfo
                         processed_audio[:, 1] *= lfo
                    else:
                        lfo = (1 - tremolo_depth) + tremolo_depth * np.sin(2 * np.pi * tremolo_rate_hz * lfo_time)
                        processed_audio = processed_audio * lfo
                    
                    effect_name += "+Tremolo" if effect_name else "Tremolo"
                    
                elif pat == "B": # Auto-Pan
                    print(f"  - Applying Auto-Pan (B)")
                    pan_rate_hz = 0.5
                    current_len = len(processed_audio)
                    
                    pan_lfo = np.sin(2 * np.pi * pan_rate_hz * (np.arange(current_len) / sample_rate))
                    pan_angle = (pan_lfo + 1) * (np.pi / 4)
                    left_gain = np.cos(pan_angle)
                    right_gain = np.sin(pan_angle)
                    
                    if processed_audio.ndim == 1:
                        # Mono -> Stereo
                        left_channel = processed_audio * left_gain
                        right_channel = processed_audio * right_gain
                        processed_audio = np.empty((current_len, 2), dtype=np.float32)
                        processed_audio[:, 0] = left_channel
                        processed_audio[:, 1] = right_channel
                    else:
                        # Stereo -> Modulate existing channels
                        processed_audio[:, 0] *= left_gain
                        processed_audio[:, 1] *= right_gain
                    
                    effect_name += "+Auto-Pan" if effect_name else "Auto-Pan"
                    
                elif pat == "C": # Shimmer Reverb
                    print(f"  - Applying Shimmer Reverb (C)")
                    shimmer_board = Pedalboard([
                        PitchShift(semitones=12),
                        Reverb(room_size=0.9, damping=0.5, wet_level=0.8, dry_level=0.2),
                        Gain(gain_db=-6)
                    ])
                    # Pedalboard handles stereo input naturally
                    shimmer_audio = shimmer_board(processed_audio, sample_rate)
                    processed_audio = (processed_audio * 0.8) + (shimmer_audio * 0.5)
                    effect_name += "+Shimmer" if effect_name else "Shimmer"
    
                elif pat == "D": # Delay
                    print(f"  - Applying Delay (D)")
                    # Use params from request or default
                    d_seconds = float(data.get("delay_seconds", 0.5))
                    d_feedback = float(data.get("delay_feedback", 0.4))
                    d_mix = float(data.get("delay_mix", 0.5))
                    
                    delay_board = Pedalboard([
                        Delay(delay_seconds=d_seconds, feedback=d_feedback, mix=d_mix),
                        Gain(gain_db=0)
                    ])
                    processed_audio = delay_board(processed_audio, sample_rate)
                    effect_name += "+Delay" if effect_name else "Delay"

                elif pat == "E": # Chorus
                    print(f"  - Applying Chorus (E)")
                    # Use params from request or default
                    c_rate = float(data.get("chorus_rate", 2.1))
                    c_depth = float(data.get("chorus_depth", 0.45))
                    c_mix = float(data.get("chorus_mix", 0.3))
                    
                    chorus_board = Pedalboard([
                        Chorus(rate_hz=c_rate, depth=c_depth, centre_delay_ms=7.0, feedback=0.0, mix=c_mix),
                        Gain(gain_db=0)
                    ])
                    processed_audio = chorus_board(processed_audio, sample_rate)
                    effect_name += "+Chorus" if effect_name else "Chorus"
        elif day_of_week is not None:
            day = int(day_of_week)
            if day in [1, 3, 6]: # Mon, Wed, Sat -> Tremolo
                effect_name = "Tremolo"
                tremolo_rate_hz = 6.0
                tremolo_depth = 0.3
                lfo_time = np.arange(len(audio)) / sample_rate
                lfo = (1 - tremolo_depth) + tremolo_depth * np.sin(2 * np.pi * tremolo_rate_hz * lfo_time)
                processed_audio = audio * lfo

            elif day in [2, 5]: # Tue, Fri -> Auto-Pan
                effect_name = "Auto-Pan"
                pan_rate_hz = 0.5
                pan_lfo = np.sin(2 * np.pi * pan_rate_hz * (np.arange(len(audio)) / sample_rate))
                pan_angle = (pan_lfo + 1) * (np.pi / 4)
                left_gain = np.cos(pan_angle)
                right_gain = np.sin(pan_angle)
                left_channel = audio * left_gain
                right_channel = audio * right_gain
                processed_audio = np.empty((len(audio), 2), dtype=np.float32)
                processed_audio[:, 0] = left_channel
                processed_audio[:, 1] = right_channel

            elif day in [0, 4]: # Sun, Thu -> Shimmer Reverb
                effect_name = "Shimmer Reverb"
                shimmer_board = Pedalboard([
                    PitchShift(semitones=12),
                    Reverb(room_size=0.9, damping=0.5, wet_level=0.8, dry_level=0.2),
                    Gain(gain_db=-6)
                ])
                shimmer_audio = shimmer_board(audio, sample_rate)
                processed_audio = (audio * 0.8) + (shimmer_audio * 0.5)
        
        else:
             # Default if neither provided
             effect_name = "None"

        print(f"Applied effect: {effect_name}")

        # Normalize
        max_val = np.max(np.abs(processed_audio))
        if max_val > 1.0:
            processed_audio = processed_audio / max_val

        # --- Export and Encode ---
        buffer = io.BytesIO()
        sf.write(buffer, processed_audio, sample_rate, format='WAV')
        buffer.seek(0)
        audio_base64 = base64.b64encode(buffer.read()).decode('utf-8')

        return {
            "message": f"{effect_name} effect applied successfully.",
            "effect_applied": effect_name,
            "audio_format": "wav",
            "audio_data_base64": audio_base64
        }

    except Exception as e:
        print(f"--- ERROR in /process-sleep-data ---")
        print(e)
        raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")

@app.post("/analyze-sleep-cycle")
async def analyze_sleep_cycle(payload: Dict[str, Any]):
    """
    Receives a list of sleep logs and a bedtime, analyzes them to find an average cycle,
    and returns recommended wake-up times.
    """
    sleep_logs = payload.get("sleep_logs")
    bedtime_str = payload.get("bedtime")

    if not sleep_logs or not isinstance(sleep_logs, list) or len(sleep_logs) == 0:
        raise HTTPException(status_code=400, detail="Sleep logs cannot be empty.")
    if not bedtime_str or not isinstance(bedtime_str, str) or not len(bedtime_str) == 5:
        raise HTTPException(status_code=400, detail="Valid bedtime in HH:MM format is required.")

    all_cycle_durations = []
    analyzed_log_ids = []

    for log in sleep_logs:
        if log.get('timeInBed', 0) * 60 < 210:
            continue

        analyzed_log_ids.append(log.get('logId'))

        if 'levels' in log and 'data' in log['levels']:
            sleep_stages = log['levels']['data']
            rem_sleep_timestamps = []

            for stage in sleep_stages:
                if stage['level'] == 'rem':
                    start_time_dt = pd.to_datetime(stage['dateTime'])
                    rem_sleep_timestamps.append(start_time_dt)
            
            if len(rem_sleep_timestamps) > 1:
                for i in range(1, len(rem_sleep_timestamps)):
                    duration = (rem_sleep_timestamps[i] - rem_sleep_timestamps[i-1]).total_seconds() / 60
                    if 50 <= duration <= 120:
                        all_cycle_durations.append({"logId": log.get('logId'), "duration": duration})

    if not all_cycle_durations:
        average_cycle_minutes = 90
        message = "レム睡眠のサイクルを特定できませんでした。デフォルトの90分サイクルを使用します。"
    else:
        average_cycle_minutes = np.mean([item['duration'] for item in all_cycle_durations])
        message = f"分析の結果、あなたの平均的な睡眠サイクルは約{average_cycle_minutes:.1f}分です。"

    hours, minutes = map(int, bedtime_str.split(':'))
    bedtime = pd.Timestamp.now().normalize() + pd.Timedelta(hours=hours, minutes=minutes)
    sleep_start_time = bedtime + pd.Timedelta(minutes=15)

    recommendations = []
    for cycles in [4, 5, 6]:
        wakeup_time = sleep_start_time + pd.Timedelta(minutes=average_cycle_minutes * cycles)
        recommendations.append(wakeup_time.strftime('%H:%M'))

    return {
        "message": message,
        "times": recommendations,
        "average_sleep_cycle_minutes": round(average_cycle_minutes, 1),
        "analyzed_logs_count": len(analyzed_log_ids),
        "cycle_durations_list": all_cycle_durations
    }

@app.post("/resample-and-analyze")
async def resample_and_analyze(data: Dict[str, Any]):
    """
    Resamples the intraday heart rate data to a consistent 1-second interval.
    """
    hr_dataset = data.get("hr_dataset")
    if not hr_dataset:
        raise HTTPException(status_code=400, detail="hr_dataset is required.")

    try:
        # Extract the date and the time series data
        date_str = hr_dataset.get("activities-heart", [{}])[0].get("value")
        intraday_data = hr_dataset.get("activities-heart-intraday", {}).get("dataset", [])

        if not date_str or not intraday_data:
            raise HTTPException(status_code=400, detail="Invalid hr_dataset format.")

        # Create a pandas DataFrame
        df = pd.DataFrame(intraday_data)
        
        # Combine date and time to create a proper datetime index
        df['time'] = pd.to_datetime(date_str + ' ' + df['time'])
        df = df.set_index('time')

        # Resample to 1-second intervals and forward-fill missing values
        df_resampled = df.resample('1S').ffill()

        # Convert the resampled data back to a JSON-friendly format
        df_resampled = df_resampled.reset_index()
        resampled_data = {
            "time": df_resampled['time'].dt.strftime('%H:%M:%S').tolist(),
            "value": df_resampled['value'].tolist()
        }

        return {
            "message": "Heart rate data resampled successfully.",
            "resampled_data": resampled_data
        }

    except Exception as e:
        print(f"--- ERROR in /resample-and-analyze ---")
        print(e)
        raise HTTPException(status_code=500, detail=f"Error resampling data: {str(e)}")

@app.post("/analyze-awakening")
async def analyze_awakening(data: Dict[str, Any]):
    """
    Calculates awakening index metrics (slope and standard deviation) from HR data.
    """
    hr_dataset = data.get("hr_dataset")
    if not hr_dataset:
        raise HTTPException(status_code=400, detail="hr_dataset is required.")

    try:
        # --- Step 1: Resample data to 1-second intervals ---
        # CORRECTED: Use 'dateTime' field for the date, not 'value'
        date_str = hr_dataset.get("activities-heart", [{}])[0].get("dateTime")
        intraday_data = hr_dataset.get("activities-heart-intraday", {}).get("dataset", [])

        if not date_str or not intraday_data:
            raise HTTPException(status_code=400, detail="Invalid hr_dataset format for resampling.")

        df = pd.DataFrame(intraday_data)
        df['time'] = pd.to_datetime(date_str + ' ' + df['time'], format='%Y-%m-%d %H:%M:%S')
        df = df.set_index('time')
        df_resampled = df.resample('1s').ffill().bfill()
        
        hr_values = df_resampled['value'].to_numpy()

        if len(hr_values) < 120:
             raise HTTPException(status_code=400, detail=f"Insufficient data for analysis. At least 120 points needed, got {len(hr_values)}.")

        # --- Step 2: Calculate Slope over the actual duration of data ---
        time_axis_slope = np.arange(len(hr_values))
        slope = np.polyfit(time_axis_slope, hr_values, 1)[0]

        # --- Step 3: Calculate Standard Deviation for the middle 2 minutes (robustly) ---
        center_index = len(hr_values) // 2
        start_index = max(0, center_index - 60)
        end_index = min(len(hr_values), center_index + 60)
        
        hr_stddev_data = hr_values[start_index:end_index]
        std_dev = np.std(hr_stddev_data)

        return {
            "message": "Awakening analysis successful.",
            "awakening_hr_slope": float(slope),
            "awakening_hr_stddev": float(std_dev)
        }

    except Exception as e:
        print(f"--- ERROR in /analyze-awakening ---")
        print(e)
        raise HTTPException(status_code=500, detail=f"Error in awakening analysis: {str(e)}")

@app.post("/calculate-awakening-metrics")
async def calculate_awakening_metrics(data: Dict[str, Any]):
    """
    Calculates awakening metrics (slope and stddev) from a heart rate array.
    Expects: { "hr_values": [65, 72, 78, ...] }
    Returns: { "awakening_hr_slope": float, "awakening_hr_stddev": float }
    """
    hr_values = data.get("hr_values")
    
    if not hr_values or not isinstance(hr_values, list):
        raise HTTPException(status_code=400, detail="hr_values array is required.")
    
    try:
        hr_array = np.array(hr_values, dtype=float)
        
        # Use first 4 minutes (240 seconds) of data
        max_points = min(240, len(hr_array))
        hr_data = hr_array[:max_points]
        
        if len(hr_data) < 60:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient data. At least 60 points needed, got {len(hr_data)}."
            )
        
        # Calculate slope using linear regression (bpm/second)
        time_axis = np.arange(len(hr_data))
        slope = np.polyfit(time_axis, hr_data, 1)[0]
        
        # Calculate standard deviation
        std_dev = np.std(hr_data)
        
        print(f"[AWAKENING-METRICS] Calculated: slope={slope:.4f}, stddev={std_dev:.4f}, points={len(hr_data)}")
        
        return {
            "awakening_hr_slope": float(slope),
            "awakening_hr_stddev": float(std_dev),
            "data_points_used": len(hr_data)
        }
        
    except Exception as e:
        print(f"--- ERROR in /calculate-awakening-metrics ---")
        print(e)
        raise HTTPException(status_code=500, detail=f"Error calculating metrics: {str(e)}")

@app.post("/calculate-dtw-similarity")
async def calculate_dtw_similarity(data: Dict[str, Any]):
    """
    Calculates DTW similarity between current HR pattern and past events.
    Expects: { 
        "current_pattern": [60, 61, ...],
        "past_events": [{"event_id": 1, "hr_pattern_before": [...], "mixing_pattern": "A", "comfort_score": 75.5}, ...]
    }
    Returns: { "similarities": [{event_id, similarity, mixing_pattern, comfort_score}, ...] }
    """
    try:
        from dtaidistance import dtw
    except ImportError:
        raise HTTPException(status_code=500, detail="dtaidistance library not installed. Run: pip install dtaidistance")
    
    current_pattern = data.get("current_pattern")
    past_events = data.get("past_events", [])
    
    if not current_pattern or not isinstance(current_pattern, list):
        raise HTTPException(status_code=400, detail="current_pattern array is required.")
    
    try:
        current_array = np.array(current_pattern, dtype=float)
        similarities = []
        
        for event in past_events:
            past_pattern = event.get("hr_pattern_before")
            if not past_pattern:
                continue
            
            past_array = np.array(past_pattern, dtype=float)
            
            # Calculate DTW distance
            distance = dtw.distance(current_array, past_array)
            
            # Convert to similarity (0-1, higher is more similar)
            similarity = 1 / (1 + distance)
            
            similarities.append({
                "event_id": event.get("event_id"),
                "similarity": float(similarity),
                "mixing_pattern": event.get("mixing_pattern"),
                "comfort_score": event.get("comfort_score")
            })
        
        # Sort by similarity (descending)
        similarities.sort(key=lambda x: x["similarity"], reverse=True)
        
        print(f"[DTW-SIMILARITY] Calculated {len(similarities)} similarities")
        
        return {"similarities": similarities}
        
    except Exception as e:
        print(f"--- ERROR in /calculate-dtw-similarity ---")
        print(e)
        raise HTTPException(status_code=500, detail=f"Error calculating DTW similarity: {str(e)}")

@app.post("/recommend-mixing")
async def recommend_mixing(data: Dict[str, Any]):
    """
    Recommends optimal alarm mixing based on DTW similarity.
    Expects: { "current_pattern": [...], "past_events": [...] }
    Returns: { "recommended_mixing": "A", "confidence": 0.85, "mixing_scores": {...}, "similar_events_count": 12 }
    """
    try:
        # Calculate DTW similarities
        dtw_result = await calculate_dtw_similarity(data)
        similarities = dtw_result["similarities"]
        
        if not similarities:
            # No past data - return default
            return {
                "recommended_mixing": "A",
                "confidence": 0.5,
                "mixing_scores": {},
                "similar_events_count": 0,
                "note": "No past data available, using default mixing A"
            }
        
        # 1. Selection: DTW >= 0.8 OR Top 5
        SIMILARITY_THRESHOLD = 0.8
        similar_events = [e for e in similarities if e["similarity"] >= SIMILARITY_THRESHOLD]
        
        if len(similar_events) < 5:
            # Fallback: use top 5 if insufficient similar events
            similar_events = similarities[:min(5, len(similarities))]
            
        print(f"[RECOMMEND-MIXING] Selected {len(similar_events)} events for analysis.")

        # 2. Analyze Distribution
        # Count occurrences of each mixing pattern (including fused ones if they exist in history)
        # Note: We rely on base components for dominance check? 
        # Requirement says: "If same mixing is 60%+". If history has "A+B", is it A or B?
        # Assumption: History mostly has single patterns A-E so far. 
        # If history has "A+B", we treat it as a distinct pattern "A+B" for counting.
        
        pattern_counts = {}
        for event in similar_events:
            pat = event["mixing_pattern"]
            pattern_counts[pat] = pattern_counts.get(pat, 0) + 1
            
        total_selected = len(similar_events)
        sorted_patterns = sorted(pattern_counts.items(), key=lambda x: x[1], reverse=True)
        # sorted_patterns is list of tuples: [("A", 6), ("B", 2), ...]
        
        recommended = "A" # Default
        confidence = 0.5
        note = ""

        if not sorted_patterns:
             # Should not happen given check above
             return { "recommended_mixing": "A", "confidence": 0.0, "mixing_scores": {}, "similar_events_count": 0 }

        top_pattern, top_count = sorted_patterns[0]
        dominance_ratio = top_count / total_selected
        
        print(f"[RECOMMEND-MIXING] Top pattern: {top_pattern} ({top_count}/{total_selected}, {dominance_ratio:.2%})")

        # 3. 60% Rule
        if dominance_ratio >= 0.6:
            recommended = top_pattern
            confidence = 0.9 # High confidence due to dominance
            note = f"Dominance rule: {top_pattern} is {dominance_ratio:.1%} of similar events."
        
        else:
            # 4. Fusion Rule (2 types)
            # Take top 2 patterns
            if len(sorted_patterns) >= 2:
                pat1 = sorted_patterns[0][0]
                pat2 = sorted_patterns[1][0]
                
                # Check if we should fuse. "Fusion is up to 2 types".
                # If pat1 is already composite "A+B", we probably shouldn't add more?
                # User said: "Fusion is 2 types".
                # Simplify: We only fuse if both are single text characters? 
                # Or just fuse them string-wise and rely on backend validation/sanity?
                # Let's clean up logic: Fuse the distinct base types.
                
                # Deconstruct into base types to handle existing "A+B" in history
                bases = set()
                for p in [pat1, pat2]:
                    for b in p.split('+'):
                        bases.add(b.strip())
                
                # Limit to top 2 distinct base types if we have more
                # Sorting to ensure deterministic order (A+B vs B+A)
                unique_bases = sorted(list(bases))
                
                # If we have > 2 bases, pick top 2 based on individual counts?
                # Complex. Let's stick to simplest interpretation of User Prompt:
                # "Select top 2 patterns... fuse them".
                # If pat1="A", pat2="B" -> "A+B"
                
                candidate_fusion = []
                
                # 5. Compatibility Check
                # Forbidden:
                # - Tremolo(A) + Chorus(E) (Duplicate oscillation)
                # - Shimmer(C) + Delay(D) (Duplicate spatial)
                # - Duration? No mention.
                
                # Check combinations from our unique bases.
                # We need to pick 2 compatible bases with highest counts.
                
                # Recalculate counts for individual bases across the top patterns?
                # Actually, let's look at the similar_events again and count Base Types.
                base_counts = {}
                for event in similar_events:
                    raw_pat = event["mixing_pattern"]
                    for base in raw_pat.split('+'):
                        base = base.strip()
                        if base:
                            base_counts[base] = base_counts.get(base, 0) + 1
                
                sorted_bases = sorted(base_counts.items(), key=lambda x: x[1], reverse=True)
                print(f"[RECOMMEND-MIXING] Base counts: {sorted_bases}")
                
                if len(sorted_bases) >= 2:
                    base1 = sorted_bases[0][0]
                    base2 = sorted_bases[1][0]
                    
                    # Compatibility Validation
                    incompatible = False
                    
                    # Check A + E
                    if ("A" in [base1, base2]) and ("E" in [base1, base2]):
                        incompatible = True
                        note = "Incompatible: Tremolo(A) + Chorus(E). Fallback to dominance."
                        
                    # Check C + D
                    elif ("C" in [base1, base2]) and ("D" in [base1, base2]):
                        incompatible = True
                        note = "Incompatible: Shimmer(C) + Delay(D). Fallback to dominance."
                        
                    if incompatible:
                        # Fallback to single top frequency
                        recommended = base1
                        confidence = 0.6
                    else:
                        # Fuse them!
                        # Sort alphabetically for consistency: "A+B"
                        fused = sorted([base1, base2])
                        recommended = "+".join(fused)
                        confidence = 0.8
                        note = f"Fused top 2 bases: {base1} & {base2}"
                else:
                    # Only 1 base type found?
                    recommended = sorted_bases[0][0]
                    confidence = 0.7
                    note = "Only 1 base type found in distribution."
            else:
                # Only 1 pattern exists in history
                recommended = sorted_patterns[0][0]
                confidence = 0.7
                note = "Single pattern found."

        print(f"[RECOMMEND-MIXING] Recommended: {recommended}, Confidence: {confidence:.2f}, Note: {note}")
        
        return {
            "recommended_mixing": recommended,
            "confidence": float(confidence),
            "mixing_scores": pattern_counts, # Returning raw counts as scores for now
            "similar_events_count": len(similar_events),
            "note": note
        }
        
    except Exception as e:
        print(f"--- ERROR in /recommend-mixing ---")
        print(e)
        raise HTTPException(status_code=500, detail=f"Error recommending mixing: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
