#pragma once
// Device geometry: NanosheetFET3D — symmetric 3-region GAA nanosheet FET.

#include <cmath>
#include <vector>
#include <algorithm>

namespace qt {

struct NanosheetFET3D {
    double tSD;
    double tCh;
    double xCh;
    double xSD;
    double wZ;
    double wSD;
    bool   mirrorX;

    std::vector<double> xGrid;

    double xMid, delta;

    NanosheetFET3D(double tSD, double tCh, double xCh, double xSD,
                   double wZ, const std::vector<double>& xGrid,
                   double wSD = -1.0, bool mirrorX = true)
        : tSD(tSD), tCh(tCh), xCh(xCh), xSD(xSD),
          wZ(wZ), wSD(wSD), mirrorX(mirrorX), xGrid(xGrid)
    {
        xMid  = 0.5 * (this->xCh + this->xSD);
        delta = (this->xSD - this->xCh) / 4.0;
    }

    double blendF(double x) const {
        return 0.5 * (1.0 + std::tanh((std::abs(x) - xMid) / delta));
    }

    double dFdx(double x) const {
        double arg   = (std::abs(x) - xMid) / delta;
        double sech2 = 1.0 / (std::cosh(arg) * std::cosh(arg));
        return 0.5 / delta * sech2 * (x >= 0.0 ? 1.0 : -1.0);
    }

    virtual double Lambda(double x) const {
        return tCh/2.0 + (tSD/2.0 - tCh/2.0) * blendF(x);
    }

    double dLambdaDx(double x) const {
        return (tSD - tCh) / 2.0 * dFdx(x);
    }

    virtual double lambdaY(double x) const {
        if (wSD < 0.0) return wZ / 2.0;
        return wZ/2.0 + (wSD/2.0 - wZ/2.0) * blendF(x);
    }

    double dLambdaYDx(double x) const {
        if (wSD < 0.0) return 0.0;
        return (wSD - wZ) / 2.0 * dFdx(x);
    }

    double A(double x) const {
        return 4.0 * lambdaY(x) * Lambda(x);
    }

    virtual ~NanosheetFET3D() = default;
    virtual bool   isAsymmetric() const    { return false; }
    virtual double lambdaU(double x) const { return Lambda(x); }
    virtual double lambdaD(double x) const { return Lambda(x); }
};

struct NanosheetFET3DAsym : NanosheetFET3D {
    double tChU, tChD;
    double tSDU, tSDD;

    NanosheetFET3DAsym(double tChU, double tChD,
                       double tSDU, double tSDD,
                       double xCh, double xSD,
                       double wZ, const std::vector<double>& xGrid,
                       double wSD = -1.0, bool mirrorX = true)
        : NanosheetFET3D(tSDU+tSDD, tChU+tChD,
                         xCh, xSD, wZ, xGrid, wSD, mirrorX),
          tChU(tChU), tChD(tChD),
          tSDU(tSDU), tSDD(tSDD)
    {}

    bool isAsymmetric() const override {
        for (double x : xGrid)
            if (std::abs(lambdaU(x) - lambdaD(x)) > 1e-10) return true;
        return false;
    }

    double lambdaU(double x) const override {
        return tChU/2.0 + (tSDU/2.0 - tChU/2.0) * blendF(x);
    }
    double lambdaD(double x) const override {
        return tChD/2.0 + (tSDD/2.0 - tChD/2.0) * blendF(x);
    }
    double Lambda(double x) const override {
        return 0.5 * (lambdaU(x) + lambdaD(x));
    }
    double A(double x) const {
        return 2.0 * lambdaY(x) * (lambdaU(x) + lambdaD(x));
    }
};

} // namespace qt
