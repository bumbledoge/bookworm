# AI Specialist - Front End and Mobile Capstone Project Instructions

---

## 1. Introduction & Overview

This capstone project provides an opportunity to move beyond theory and apply AI within a real-world development workflow. You will leverage **Agentic IDEs** (such as **IBM BOB** or **AWS Kiro**) to transform design wireframes into functional frontend solutions, mirroring modern AI-powered engineering team practices.

### Key Objectives & Outcomes
By completing this capstone project, you will be able to:
- **Leverage Agentic IDEs** to accelerate frontend development.
- **Convert UI designs** into working code.
- **Generate, review, and refine** AI-produced components.
- **Set up, test, and validate** end-to-end frontend applications.
- **Use Git workflows** to manage and deliver code.
- **Clearly articulate** your AI-assisted development process.

---

## 2. Before You Start (Prerequisites & Support)

1. **Access Agentic IDEs:**
   - Gain access to **IBM BOB** (via the provided registration form/guidelines) or use another Agentic IDE like **AWS Kiro**.
   - Install the IDE on your local setup according to its installation instructions.
2. **Support Channel:**
   - Join the Slack channel `#applied-ai-specialist-capstone-project` for SME assistance and questions.
3. **Software Usage Note:**
   - Any software installed for development purposes can be removed after completing the capstone.

---

## 3. Use Case: "Book Worm" E-Commerce Platform

### Platform Overview
You are tasked with building a web/mobile platform named **Book Worm**—an online bookstore where customers can browse, select, and purchase books.

### Customer Journeys & Functional Requirements
1. **Login Page & Authentication:**
   - Support for Guest users and Registered users.
   - Role & entitlement management.
2. **E-Store Home & Catalogue:**
   - Select product categories, filter by language, format (paperback, e-book), price range, and sorting rules (e.g., relevance).
   - Search functionality for books, authors, or keywords.
   - Featured sections: *Recommended for You*, *Bestsellers this Month*, and *New Launches*.
3. **Order History & Personalization:**
   - Order history with a "Buy It Again" feature.
   - Item recommendations driven by user order history.
4. **Product Detail Page:**
   - Display product metadata (author, publisher, price, tentative delivery date, ratings, total sales).
   - Actions: *Add to Cart*, *Add to Wishlist*.
   - Author profile section ("About the writer").
   - Reviews section with rating submission and user commentary.
   - Related products / "Related Reads" sidebar.
5. **Shopping Cart & Checkout:**
   - Product list with quantity modifiers (`-`, `+`).
   - Shipping address management (saved addresses or manual entry form).
   - Order summary calculations: Item subtotal, taxes, delivery charges, coupon discounts, and grand total.
6. **Payment & Confirmation:**
   - Flexible payment options: Credit Card, Debit Card, UPI, Wallet, or gift points redemption.
   - Payment confirmation modal/screen.
   - Order purchase confirmation message.
   - Capability to cancel orders within 48 hours.

---

## 4. System Architecture & Workflow Flowchart

```
[ Registered User ] ---> [ User Login ] ---\
                                            +---> [ Home Page ] ---> [ Browse Catalogue ]
[ Guest User ] ----------------------------/                              |
                                                                          v
[ Shipment ] <--- [ Payment Processing ] <------------------------- [ Add to Cart ]
     |                     |                                              |
     v                     v                                              v
 - Rate Calculation    - Gateway Processing                         - Create/Modify Order
 - Approx. Delivery    - Refund Processing                          - Order Checkout
 - Return Shipment     - Confirmation & Wallet/Gift                 - Redeem Coupons/Points
```

### Technology Components & Stack
- **Database:** PostgreSQL
- **UI Code Generation:** Vibe Coding with IBM BOB or AWS Kiro
- **API Specification:** OpenAPI Spec Generation (Manual / AI-assisted Data Modeling based on wireframes)
- **Backend Services:** AI-augmented services generated via IBM BOB or AWS Kiro
- **Test Case Generation:** ICA Agent (e.g., Test Scenario Generator, API Test Case Generator, React Test Case Generator)
- **Deployment:** Local environment or Cloud Environment (e.g., AWS ROSA, IBM ROKS)
- **Version Control:** GitHub PR submission

---

## 5. Step-by-Step Development Workflow

### **Step 1: Prepare UI Reference Images**
- Capture or export UI wireframes/screens as `.png` or `.jpg` files.
- Use clean full-screen images organized by view (*Homepage*, *Product Detail*, *Cart*, *Checkout*, *Payment*).

### **Step 2: Initialize Agentic IDE**
- Launch **IBM BOB** or **AWS Kiro**.
- Open a new frontend development project.
- Select your target framework (e.g., **React** or **Angular**).

### **Step 3: Prompt AI with Screenshots**
- Upload screen mockups directly into the IDE interface.
- *Example Prompt:* 
  > "Generate responsive React frontend code from these bookstore UI screenshots using reusable components, clean folder structure, and Tailwind CSS."

### **Step 4: Code Generation (Web or Mobile)**
- Prompt the agent to construct:
  - Page layouts and responsive grids.
  - Navigation bars, cards, form controls, and footers.
  - State management and routing logic.

### **Step 5: Code Review & Refactoring**
- Evaluate generated structure, component reusability, dark/light theme consistency, and responsiveness.
- Eliminate duplicated or unnecessary style classes/code blocks.

### **Step 6: Local Project Integration**
- Import generated components into your local project environment.
- Install necessary package dependencies (`npm install` / `yarn`).
- Connect frontend components with REST/OpenAPI endpoints if backend services are available.

### **Step 7: Local Run & Verification**
- Spin up the local development server (`npm start` / `npm run dev`).
- Test responsiveness across desktop and mobile viewports.
- Interactively test forms, buttons, routing, and shopping workflows.

### **Step 8: Refine and Polish**
- Fix alignment, padding, and UI inconsistencies.
- Add loading spinners, empty states, and field validation rules.
- Clean up unused CSS/Tailwind utility classes.

### **Step 9: Git Version Control Workflow**
- Create a dedicated feature branch.
- Stage and commit files with descriptive messages.
- Push the branch to your GitHub repository and raise a Pull Request (PR).

---

## 6. Submission Guidelines & Checklist

Before submitting your capstone, make sure you meet all the criteria listed below:

- [ ] **GitHub Repository:** Code is pushed, structured, and an open PR is created.
- [ ] **Video Demonstration (~3 Minutes):**
  - Explains the steps taken to build the responsive frontend solution.
  - Specifically highlights **how Agentic IDE tools (IBM BOB / AWS Kiro)** were used throughout the development cycle.
- [ ] **Platform Submission:**
  - Mark "Complete" on the Capstone Project tile in your Learning Plan.
  - Attach both the **3-minute video link** and the **GitHub repository PR link** on the submission tile.

---