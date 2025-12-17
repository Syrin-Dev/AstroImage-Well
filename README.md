<div align="center">
  <h1>🌌 AstroImage Well 🔭</h1>
  <h3>Your Personal Stargazing & Astrophotography Assistant</h3>

  <p align="center">
    <a href="https://flask.palletsprojects.com/">
      <img src="https://img.shields.io/badge/Made%20with-Flask-000000?style=for-the-badge&logo=flask&logoColor=white" alt="Flask" />
    </a>
    <a href="https://www.python.org/">
      <img src="https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
    </a>
    <a href="https://www.astropy.org/">
      <img src="https://img.shields.io/badge/Powered%20by-Astropy-FF6B6B?style=for-the-badge&logo=astropy&logoColor=white" alt="Astropy" />
    </a>
  </p>
  
  <p>
    <b>Plan your observation sessions, check weather conditions, and discover Deep Sky Objects (DSOs) with precision.</b>
  </p>
  <br />
</div>

---

## 📖 About The Project

**AstroImage Well** is a robust web application designed for amateur astronomers and astrophotographers. It bridges the gap between complex astronomical data and user-friendly planning tools. Whether you are planning a night of visual observation or setting up for a long-exposure imaging session, AstroImage Well provides the critical data you need.

### 🌟 Key Features

*   **🔭 Deep Sky Object Database**: Access a curated catalog of nebulae, galaxies, and clusters (Messier objects and more).
*   **📍 Real-Time Positioning**: Calculate current Altitude and Azimuth for any object based on your specific location and time.
*   **☁️ Astronomer's Weather**: Integrated weather forecasting tailored for maximizing visibility (Cloud cover, Seeing conditions).
*   **🌓 Moon Phase & Visibility**: accurate moon phase calculations to avoid light pollution during your sessions.
*   **🖥️ Modern Dashboard**: A clean, responsive web interface built with Flask and Jinja2.

---

## 🚀 Getting Started

Follow these periods to set up the project locally on your machine.

### Prerequisites

*   Python 3.8 or higher
*   Git

### 📥 Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/Ayanakoji-coder/AstroImage-Well.git
    cd AstroImage-Well
    ```

2.  **Install Dependencies**
    ```bash
    pip install -r requirements.txt
    ```
    *(Note: This installs essential libraries like `Flask`, `astropy`, `astroplan`, `requests`)*

3.  **Run the Application**
    ```bash
    # Using the provided batch script (Windows)
    .\run_app.bat
    
    # OR manually via Python
    python app.py
    ```

4.  **Open in Browser**
    Visit `http://127.0.0.1:5000` to start your journey!

---

## 🗺️ Roadmap & WIP

We are actively working on the **"Refactor AstroImage Well"** initiative to bring production-grade quality to the codebase.

- [ ] **Data Layer Expansion**: robust database integration for handling massive star catalogs.
- [ ] **Astronomy Engine Upgrade**: Enhanced precision for polar alignment and tracking.
- [ ] **Equipment Matching**: Tools to simulate field of view (FOV) for your specific telescope and camera.
- [ ] **Advanced Visualization**: Interactive sky charts and graphs.

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

<div align="center">
  <p>Created by <b>Ayanakoji-coder</b></p>
</div>