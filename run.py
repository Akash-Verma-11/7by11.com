from app import create_app
app=create_app()
if __name__=='__main__':
    import os
    app.run(host=os.getenv('BIND_ADDRESS','127.0.0.1'),port=int(os.getenv('PORT','3000')),debug=False)
