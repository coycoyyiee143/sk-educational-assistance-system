import AdminNavigation from "../components/AdminNavigation";
import BudgetPlanningSection from "../components/BudgetPlanningSection";
import PanelFooter from "../../components/PanelFooter";

function AdminBudgetPlanning() {
  return (
    <div className="admin-layout">
      <AdminNavigation />
      <div className="admin-main">
        <div className="admin-topbar">
          <div className="admin-topbar-user">
            <div className="admin-topbar-user-text">
              <span className="admin-topbar-user-name">Admin User</span>
              <span className="admin-topbar-user-role">Sangguniang Kabataan</span>
            </div>
            <div className="admin-topbar-avatar"></div>
          </div>
        </div>

        <section className="page-section">
          <div className="container-fluid">
            <div className="page-card">
              <h3 className="section-title mb-2">Budget Planning</h3>
              <p className="text-muted mb-0">
                Tools to support budget decision-making for the educational assistance program — historical estimation, statistical forecasting, and allocation planning.
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