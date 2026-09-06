import AdminNavigation from "../components/AdminNavigation";
import BudgetPlanningSection from "../components/BudgetPlanningSection";

function AdminBudgetPlanning() {
    return (
        <div>
            <AdminNavigation />
            <section className="page-section">
                <div className="container">
                    <div className="page-card">
                        <h3 className="section-title mb-2">Budget Planning</h3>
                        <p className="text-muted mb-0">
                            Tools to support budget decision-making for the educational assistance program —
                            historical estimation, statistical forecasting, and allocation planning.
                        </p>
                    </div>
                    <BudgetPlanningSection />
                </div>
            </section>
            <footer>
                <div className="container">
                    <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Admin Panel</p>
                </div>
            </footer>
        </div>
    );
}

export default AdminBudgetPlanning;