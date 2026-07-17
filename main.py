"""
Main entry point for running the BigQuery Release Notes Dashboard.
Contains an example method to start the Flask development server.
"""

from release_notes_app import app


def example_run_release_notes_dashboard():
    """
    Example function that starts the BigQuery Release Notes dashboard.
    Runs a local Flask development server.
    """
    print("=" * 60)
    print("      BigQuery Release Notes Dashboard App")
    print("=" * 60)
    print("Starting Flask web server...")
    print("Please open your web browser and navigate to:")
    print("    http://127.0.0.1:5000/")
    print("-" * 60)
    print("Press Ctrl+C to stop the server.")
    print("=" * 60)
    
    # Run the Flask app on localhost on port 5000
    app.run(host="127.0.0.1", port=5000, debug=True)


def main():
    """
    Main method calling the example showcase method.
    """
    example_run_release_notes_dashboard()


if __name__ == "__main__":
    main()
