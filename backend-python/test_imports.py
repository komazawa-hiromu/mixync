try:
    from pedalboard import Pedalboard, Reverb, PitchShift, Gain, Delay, Chorus
    print("Imports successful: Delay, Chorus found in pedalboard.")
except ImportError as e:
    print(f"Import failed: {e}")
except Exception as e:
    print(f"An error occurred: {e}")
