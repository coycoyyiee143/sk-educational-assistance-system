import AdminNavigation from "../components/AdminNavigation";
import AdminTopbarUser from "../components/AdminTopbarUser";
import BudgetPlanningSection from "../components/BudgetPlanningSection";
import PanelFooter from "../../components/PanelFooter";

function AdminBudgetPlanning() {
    return (
        <div className="admin-layout">
            <AdminNavigation />

            <div className="admin-main">
                <div className="admin-topbar">
                    <AdminTopbarUser />
                </div>

                <section className="page-section">
                    <div className="container-fluid">

                        <div className="page-card">
                            <h3 className="section-title mb-2">
                                Budget Planning
                            </h3>

                            <p className="text-muted mb-0">
                                Tools to support budget decision-making
                                for the educational assistance program —
                                historical estimation, statistical
                                forecasting, and allocation planning.
                            </p>
                        </div>

                        <BudgetPlanningSection />

                    </div>
                </section>

                <PanelFooter />
            </div>
        </div>
    );
}

export default AdminBudgetPlanning;