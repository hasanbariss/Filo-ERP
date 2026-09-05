(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.MaintenanceTracking=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
    'use strict';
    const validNumber=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
    const timestamp=value=>typeof value==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(value)?Date.parse(value):NaN;
    // Recalculate from a fixed anchor, never increment the stored odometer on retry.
    function mileageFromAnchor(anchor,segments,until){
        const start=timestamp(anchor?.at),end=timestamp(until);
        if(!validNumber(anchor?.km)||!Number.isFinite(start)||!Number.isFinite(end)||end<start)return {status:'invalid',km:null};
        let cursor=start,km=anchor.km;
        for(const segment of [...(segments||[])].sort((a,b)=>timestamp(a.start)-timestamp(b.start))){
            const from=timestamp(segment.start),to=timestamp(segment.end);
            if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from||!validNumber(segment.km)||segment.complete!==true)return {status:'incomplete',km:null};
            if(from!==cursor||to>end)return {status:'incomplete',km:null};
            cursor=to;km+=segment.km;
        }
        return cursor===end?{status:'ready',km,at:until,source:'gps-distance'}:{status:'incomplete',km:null};
    }
    function maintenanceStatus(input){
        const hasKm=validNumber(input.intervalKm)&&input.intervalKm>0;
        const hasDays=validNumber(input.intervalDays)&&input.intervalDays>0;
        let remainingKm=null,remainingDays=null;
        if(hasKm&&validNumber(input.serviceKm)&&validNumber(input.currentKm)&&input.currentKm>=input.serviceKm)remainingKm=input.serviceKm+input.intervalKm-input.currentKm;
        const start=timestamp(input.serviceAt),now=timestamp(input.asOf);
        if(hasDays&&Number.isFinite(start)&&Number.isFinite(now)&&now>=start)remainingDays=(start+input.intervalDays*86400000-now)/86400000;
        const due=(remainingKm!==null&&remainingKm<=0)||(remainingDays!==null&&remainingDays<=0);
        const incomplete=(!hasKm&&!hasDays)||(hasKm&&remainingKm===null)||(hasDays&&remainingDays===null);
        return {status:due?'due':incomplete?'unknown':'current',remainingKm,remainingDays,incomplete};
    }
    function estimateFuel(input){
        const fields=['anchorLiters','capacityLiters','addedLiters','distanceKm','litersPer100Km'];
        if(input.completeData!==true||fields.some(field=>!validNumber(input[field]))||input.capacityLiters<=0||input.litersPer100Km<=0)return {status:'unknown',liters:null,rangeKm:null};
        const liters=input.anchorLiters+input.addedLiters-input.distanceKm*input.litersPer100Km/100;
        if(input.anchorLiters>input.capacityLiters||liters<0||liters>input.capacityLiters)return {status:'needs-reconciliation',liters:null,rangeKm:null};
        return {status:'estimated',liters,rangeKm:liters/input.litersPer100Km*100};
    }
    return {mileageFromAnchor,maintenanceStatus,estimateFuel};
});
