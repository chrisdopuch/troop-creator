﻿/* global troopCreator */
'use strict';

// Controller to display the troop creator
troopCreator.controller('buildCtrl', ['$scope', '$http', '$routeParams', '$location', '$window',
    function ($scope, $http, $routeParams, $location, $window) {
    
    	$http.get('./data/' + $routeParams.army + '.json').
		success(
            function(data, status, headers, config) {
                // only add data with entries

                $scope.data = [];
                $.each(data.groups, function(key, item) {
                    if (item.entries.length !== 0) {
                        $scope.data.push(item);
                    }
                });

                $scope.tiers            = data.tiers;
                $scope.tiersOptions     = [];
                $scope.tier             = {};
                $scope.tierLevel        = 0;
                $scope.selectedModels   = [];
                $scope.gameCaster       = 1;
                $scope.gamePoints       = 50;
                $scope.gameTier         = '';
                $scope.gameObjective    = '';
                $scope.modalLevel       = 0;
                $scope.points           = 0;
                $scope.dropModel        = {};
                $scope.casterPoints     = 0;
                $scope.costAlterations  = [];
                $scope.faAlterations    = [];
                $scope.freeModels       = {'id': [], 'count': 0};
                $scope.faction          = $('#' + $routeParams.army).data('faction');
                $scope.factionId        = 'faction_' + $routeParams.army;
                $scope.system           = $('#' + $routeParams.army).data('system');
                $scope.location         = $location;

                // We must convert the Tiers in an array for select
                $.each(data.tiers, function(key, value) {
                    $scope.tiersOptions.push({
                        key: key,
                        label: value.name
                    });
                });

                // Objective Data
                $scope.objectives = ['Arcane Wonder', 'Amory', 'Bunker', 'Effigy of Valor', 'Fuel Cache', 'Stockpile'];

                // Now we get the mercenarys and minions
                $.each(['minion', 'mercenary'], function (k, v) {
                    if ( v !== $routeParams.army ) {
                        $http.get('./data/' + v + '.json').
                        success(
                            function (data) {
                                // Only who works for the faction get in list
                                $.each(data.groups, function (gkey, group) {
                                    if (group.entries.length !== 0) {

                                        // Now we check all models if he work for the faction
                                        group.entries = $.grep(group.entries, function (item) {
                                            if (item.works_for) {
                                                // We have an caster, unit or solo and must look if he works_for this faction
                                                if ($.inArray($scope.factionId, item.works_for) !== -1) {
                                                    return true;
                                                }
                                            } else if (item.restricted_to) {
                                                // We have an restricted model but not all data fetched we save reference for later
                                                // If we have an UA we can already watch for the restricted_to Unit
                                                // UAs restricted_to always string i hope ^^
                                                if ( /^ua/i.test(item.type) ) {
                                                    return $scope.getModelById(item.restricted_to);
                                                } else {
                                                    return true;
                                                }
                                            }
                                            return false;
                                        });
                                        group.add = v;
                                        $scope.data.push(group);
                                    }
                                });

                                if ( v === 'mercenary' || $routeParams.army === 'mercenary' ) {
                                    if (!$window.ga || /127\.0\.0\.1/i.test($location.host())) {
                                        $scope.devAddId();
                                    }

                                    //restore from URL after we load the last data and we start watching scope Changes
                                    $scope.restoreSearch();
                                    $scope.$watchGroup(['gamePoints', 'gameCaster'], function() {
                                        $scope.updateSearch();
                                    });
                                }
                            }
                        ). error (
                            function (data) {
                                alert('error reading ' + v + '.json');
                            }
                        );
                    }
                });

                var favicon = new Favico();
                var image = $('#' + $routeParams.army + ' img')[0];
                favicon.image(image);

                document.title = $scope.faction + ' - Troop Creator';

                // Menu set selected
                $( '#top-menu li' ).removeClass( 'active' );
                $( '#' + $routeParams.army ).closest('li').addClass('active');

                $('.btn').focus(function() {
                    this.blur();
                });
		    }
        ).
		error(
            function(data, status, headers, config) {
                alert('error reading ' + $routeParams.army + '.json');
		    }
        );

        $scope.openList = function() {
            $('#left-col-build').toggleClass('active');
        };

        // Check if model an warcaster/warlock
        $scope.checkIsCaster = function(model) {
            return /^warcaster$|^warlock$/i.test(model.type);
        };

        // Filter the selected Models and return only the Models that allowed
        $scope.allowedModels = function(models) {
            models = $.grep(models, function(model) {
                //Check first if we have an Tier and is this model allowed
                if ($scope.gameTier) {
                    var tier  = $scope.tiers[$scope.gameTier];
                    if (tier.levels[0].onlyModels.ids.indexOf(model.id) === -1 && tier.casterId !== model.id) {
                        return false;
                    }
                }

                //Now we Check if we have the restricted model available
                if ( model.hasOwnProperty('restricted_to') ) {
                    if (typeof model.restricted_to === 'string') {
                        if ($scope.getModelById(model.restricted_to) || model.restricted_to === '*') {
                            return true;
                        }
                    } else {
                        var found = false;
                        $.each(model.restricted_to, function(id, val) {
                            if ( $scope.getModelById(val) ) {
                                found = true;
                                return false;
                            }
                        });
                        return found;
                    }
                    return false;
                }
                return true;
            });
            return models;
        };

		// Check if this model available
		$scope.checkModelAvailable = function(model) {
            var cost = $scope.getModelCost(model, true),
                getFa = $scope.getModelFa(model);

            if ( $scope.gameTier && $scope.checkModelTier(model) ) {
                return true;
            }

			// gameCaster not set or no usable int
			if ( typeof $scope.gameCaster === 'undefined' || $scope.gameCaster.length === 0 || isNaN($scope.gameCaster)) {
                return true;
            }

            // gamePoints not set or no usable int
			if ( typeof $scope.gamePoints === 'undefined' || $scope.gamePoints.length === 0 || isNaN($scope.gamePoints)) {
                return true;
            }

			// Warlock have max value in selectedModels
            if ( /^warlock$|^warcaster$/i.test(model.type) && $scope.countSelectedModel('^warlock$|^warcaster$').all >= $scope.gameCaster ) {
				return true;
            }

			// No Caster or other model can control warbeast or warjack in selectedModels we can not select an Warbeast or Warjack
            if ( /warbeast|warjack/i.test(model.type) && $scope.countSelectedModel('^warlock$|^warcaster$|lesserwarlock|journeyman|marshall').all === 0 ) {
                return true;
            } else if (/warbeast|warjack/i.test(model.type) && $scope.countSelectedModel('^warlock$|^warcaster$').all === 0) {
                // We must look if the selected journyman or lesser warlock has an restricted_to or marshall max value overdone
                var checkLesser = false;
                if ( $scope.selectedModels.length > 0 ) {
                    $.each($scope.selectedModels, function (key, sModel) {
                        // Marshals can only have 2
                        if ( /marshall/i.test(sModel['type']) && sModel['group'].length < 2 ) {
                            checkLesser = true;
                        } else if ( sModel.hasOwnProperty('restricted_to') ) {
                            // An Lesser Warlock can have an restricted_to then he can not add all models
                            var restrictedTo = sModel.restricted_to;
                            if (typeof sModel.restricted_to === 'string') {
                                restrictedTo = model.restricted_to.split(' ');
                            }
                            if ( restrictedTo.indexOf(model.id) !== -1 ) {
                                checkLesser = true;

                            }
                        } else if ( !/marshall/i.test(sModel['type']) ) {
                            // All fine if the sModel if not an marshall
                            checkLesser = true;
                        }

                        return !checkLesser;
                    });

                    if ( checkLesser !== true ) {
                        return true;
                    }
                }
            }

            // The Points to use are higher as the available points but check if warbeast an we have available caster points
            if ( /^warbeast$|^warjack$/i.test(model.type) && parseInt($scope.casterPoints) > 0) {
		    	if ( ( parseInt($scope.gamePoints) - parseInt($scope.points) + parseInt($scope.casterPoints) ) < cost) {
		            return true;
				}
            } else if ( !$scope.checkIsCaster(model) ) {
                if ( ( parseInt($scope.gamePoints) - parseInt($scope.points) ) < cost) {
                    return true;
                }
            }

            // Check if field allowance at cap
            if ( !getFa || getFa !== 'U' ) {
                var mc = $scope.countSelectedModel(model.id, 'id'),
                    fa = false;

                if (getFa === 'C' && mc.all > 0) {
                    fa = true;
                } else if (getFa <= mc.normal) {
                    fa = true;
                }

                // Check if this an free tier model an ignores the FA
                if ( cost === 0 && model.cost !== 0 ) {
                    fa = false;
                }

				// field allowance full
				if ( fa === true ) {
					return true;
				}
            }

            // The model only can attached to but not set the base model
            // restricted_to is in lesser warlock the same naming for other use
            if ( model.hasOwnProperty('restricted_to') && ( !/lesserwarlock|journeyman|marshall/i.test(model.type) || /^ua/i.test(model.type)) ) {
            	var search = model.restricted_to;
                if (typeof model.restricted_to !== 'string') {
                    search = model.restricted_to.join('|');
                }
                var countRestricted = $scope.countSelectedModel(search, 'id'),
                    countModel = $scope.countSelectedModel(model.id, 'id');

                // The restricted model is not set
                if ( countRestricted.all === 0 ) {
                    return true;
                }

                // restricted models can only add once per restricted model
                // But we have some jacks or beast that only can restricted to an special caster (mercanary, minions or chatacter adds to caster)
                // have the Jack or Beast 0 cost is the same as an UA only once per restricted caster
                if ( !/^war/i.test(model.type) || (/^war/i.test(model.type) && model.cost === 0) ) {
                    if ( !(countRestricted.all > 0 && countRestricted.all > countModel.all) ) {
                        return true;
                    }
                }

                // if the Type UA or WA we can not add more UAs or WAs as Units
                if ( /^ua$|^wa$/i.test(model.type) ) {
                    if ( $scope.searchFreeUnit(model) === false ) {
                        return true;
                    }
                }
            }

            // All its fine we can activate the model
            return false;
        };

        // we have an Tier an check if the model allowed
        $scope.checkModelTier = function(model) {
            var tier = $scope.tiers[$scope.gameTier];
            return tier.levels[0].onlyModels.ids.indexOf(model.id) === -1;
        };

        // count models with regex in selected list by value
        $scope.countSelectedModel = function(match, value, group) {
            if ( typeof value === 'undefined' ) { value = 'type'; }
            if ( typeof group === 'undefined' ) { group = false; }

            var count = 0,
                countFree = 0,
                matcher = new RegExp(match, 'i');

            if ( $scope.selectedModels ) {
                var recursive = function(models) {
                    $.each(models, function (key, model) {
                        if ( matcher.test(model[value]) ) {
                            if ( model.freeModel ) {
                                countFree++;
                            } else {
                                count++;
                            }
                        }
                        recursive(model.group);
                    });
                };

                if ( group !== false ) {
                    recursive($scope.selectedModels[group].group);
                } else {
                    recursive($scope.selectedModels);
                }
            }
            return {'normal': count, 'free': countFree, 'all': (count + countFree)};
        };

        // Search for an free Unit without the same type of model
        $scope.searchFreeUnit = function(model) {
            var count = $scope.selectedModels.length - 1,
                restrictedTo = model.restricted_to,
                findIdx = false;
            if (typeof model.restricted_to === 'string') {
                restrictedTo = [model.restricted_to];
            }

            for (var j = 0; j <= count; j++) {
                if ( restrictedTo.indexOf($scope.selectedModels[j].id) !== -1 ) {
                    // We only can add if there no other UA or other WA or not the same model in group
                    if ( $scope.countSelectedModel('^' + model.type + '$', 'type', j).all === 0
                        && $scope.countSelectedModel(model.id, 'id', j).all === 0 ) {
                        findIdx = j;
                    }
                }

                if ( findIdx !== false ) {
                    break;
                }
            }
            return findIdx;
        };

        // Drop callback for draggable
        $scope.dropCallback = function(event, ui) {
            var dragScope = angular.element(ui.draggable).scope();
            $scope.addModel(dragScope.model);
        };

        // start drag callback
        $scope.startCallback = function(event, ui) {
            var prevWidth = ui.helper.prevObject.width();
            ui.helper.css({'width': prevWidth});
        };

        // Add an model from the left to the right
        $scope.addModel = function(model) {
            if ( !$scope.checkModelAvailable(model) ) {
                var copy = angular.copy(model);
                    copy.group = [];
                // its an Weapon Attachmend we need an option
                if ( /^wa$/i.test(model.type) ) {
                    copy.attached = 1;
                }

                // If type warbeast or warjack we must add it in group of an caster model
                // If baseUnit set we must add this model to an unit
                var findIdx = false;
                if (/^warbeast$|^warjack$/i.test(model.type)) {
                    for (var i = $scope.selectedModels.length - 1; i >= 0; i--) {
                        if (/^warlock$|^warcaster$|lesserwarlock|journeyman|marshall/i.test($scope.selectedModels[i].type)) {
                            // Some lesserwarlocks have an restricted_to that means she only can get special beasts
                            if (!$scope.selectedModels[i].hasOwnProperty('restricted_to') ||
                                ( $scope.selectedModels[i].hasOwnProperty('restricted_to') && $scope.selectedModels[i].restricted_to.indexOf(model.id) !== -1 )) {
                                if ( !/marshall/i.test($scope.selectedModels[i].type)
                                    || (/marshall/i.test($scope.selectedModels[i].type) && $scope.countSelectedModel('^warb|^warj', 'type', i).normal < 2) ) {
                                    findIdx = i;
                                    break;
                                }
                            }
                        }
                    }
                } else if (model.hasOwnProperty('restricted_to')) {
                    findIdx = $scope.searchFreeUnit(model);
                }

                // check if the model we add an free model but only if tier
                if ( $scope.tier ) {
                    var cost = $scope.getModelCost(model, true);
                    if ( cost === 0 ) {
                        copy.realCost = copy.cost;
                        copy.cost = 0;
                        copy.freeModel = 1;
                    }
                }

                // If we find a position where we add the model add this model or add to the end
                if (findIdx !== false) {
                    copy.bonded = 1;

                    // an UAMarchall change the type of his group to unitMarshall
                    if ( /uamarshall/i.test(copy.type) ) {
                        $scope.selectedModels[findIdx].type = 'unitMarshall';
                    }

                    $scope.selectedModels[findIdx].group.push(copy);
                } else if ( $scope.countSelectedModel('^warlock|^warcaster').all === 0 && /^warlock|^warcaster/i.test(copy.type) ) {
                    $scope.selectedModels.splice(0, 0, copy);
                } else {
                    $scope.selectedModels.push(copy);
                }
                $scope.calculatePoints();
            }
        };

        // Remove an Model from the right
        $scope.removeModel = function(idx, gIdx) {
            var models = false;
            if (typeof gIdx === 'undefined' ) {
                models = $scope.selectedModels;
            } else {
                models = $scope.selectedModels[gIdx].group;
            }
            if ( models[idx].group.length > 0 ) {
                if (!confirm("if you remove this model all grouped models also remove")) {
                    return false;
                }
            }

            // an UAMarchall have change the type of his group to unitMarshall
            if ( typeof gIdx !== 'undefined' && /uamarshall/i.test(models[idx].type) ) {
                if (!confirm("if you remove this model the unit lose unitMarshall and all jacks are also remove")) {
                    return false;
                }
                $scope.selectedModels[gIdx].type = 'unit';

                // Now me must remove all warbeast or warjacks in his group
                for (var i = $scope.selectedModels[gIdx].group.length - 1; i >= 0; i--) {
                    var gModel = $scope.selectedModels[gIdx].group[i];
                    if ( /^warb|^warj/i.test(gModel.type) ) {
                        $scope.selectedModels[gIdx].group.splice(idx, 1);
                    }
                }
            }

            models.splice(idx, 1);
        	$scope.calculatePoints();
        };

        // Is there enough points to use max size
        $scope.canUseMax = function(model) {
       		return ( !model.useMax && ( parseInt($scope.gamePoints) - parseInt($scope.points) + parseInt(model.cost) ) < parseInt(model.costMax) );
        };

        // Is there enough points to change the attached
        $scope.canUseAttached = function(model, i) {
            return ( model.attached < i && ( parseInt($scope.gamePoints) - parseInt($scope.points) + parseInt(model.cost * model.attached) ) < parseInt(model.cost * i) );
        };

        // Calculate the available Points
        $scope.calculatePoints = function() {
            $scope.calculateTierLevel();
            $scope.checkFreeSelected();
            $scope.updateSearch();

			var sumPoints = 0;
			var casterPoints = 0;

			$.each( $scope.selectedModels, function( parentIdx, model ) {
                // Change the cost to the tier bonus cost
                var cost = $scope.getModelCost(model);

				if ( /^warlock$|^warcaster$/i.test(model.type) ) {
                    casterPoints = casterPoints + parseInt(cost);
				} else {
                    sumPoints = sumPoints + cost;
				}

                // If we have models in the Battle Group we must count one deeper
                $.each( model.group, function(groupIdx, gmodel) {
                    var cost = $scope.getModelCost(gmodel, false, false, parentIdx);
                    if ( /^warjack$|^warbeast$/i.test(gmodel.type) ) {
                        casterPoints = casterPoints - cost;
                    } else {
                        sumPoints = sumPoints + cost;
                    }
                });
			});

			if ( casterPoints < 0 ) {
				$scope.points = sumPoints - ( casterPoints * +1 );
			} else {
				$scope.points = sumPoints;
			}

            // Set the available Caster points for later Checks
            $scope.casterPoints = casterPoints;
		};

        // Calculate the tier level
        $scope.calculateTierLevel = function() {
            if ( $scope.tier && $scope.tier.hasOwnProperty('levels') ) {
                $scope.resetTierBonus();
                $.each($scope.tier.levels, function(idx, level) {

                    var mustCount = 0;
                    if ( !level.mustHave[0] ) {
                        $scope.tierLevel = level.level;
                        $scope.setTierBonus(level);
                    } else {

                        $.each(level.mustHave, function(idx, must) {
                            if ( must.min <= $scope.countSelectedModel(must.ids.join('|'), 'id').normal ) {
                                mustCount ++;
                            }
                        });

                        if ( level.mustHave.length === mustCount ) {
                            $scope.tierLevel = level.level;
                            $scope.setTierBonus(level);
                        } else {
                            return false;
                        }
                    }
                });
            }
        };

        // Set the Tier bonus points or models
        $scope.setTierBonus = function(level) {
            // Add alteration of points to an model
            if ( level.costAlterations.length > 0 ) {
                $.each(level.costAlterations, function(key, val) {
                    $scope.costAlterations[val.id] = val.bonus;
                });
            }
            if ( level.freeModels.length > 0 ) {
                $.each(level.freeModels, function(key, free) {
                    var eachFree = 0;
                    if ( free.forEach ) {
                        eachFree = $scope.countSelectedModel(free.forEach.join('|'), 'id').all
                    } else {
                        eachFree = 1;
                    }
                    $scope.freeModels.id = free.id;
                    $scope.freeModels.count = eachFree;
                });
            }
            if ( level.faAlterations.length > 0 ) {
                $.each(level.faAlterations, function(key, fa) {
                    if ( fa.forEach ) {
                        $scope.faAlterations[fa.id] = $scope.countSelectedModel(fa.forEach.join('|'), 'id').all;
                    } else {
                        $scope.faAlterations[fa.id] = fa.bonus;
                    }
                });
            }
        };

        // reset the Tier Bonus
        $scope.resetTierBonus = function() {
            $scope.costAlterations = [];
            $scope.freeModels = {'id': [], 'count': 0};
            $scope.faAlterations = [];
        };

        // Check Free Models in selected
        $scope.checkFreeSelected = function() {
            var recursive = function(models) {
                $.each(models, function (idx, model) {
                    if (model.hasOwnProperty('freeModel')) {
                        var isFree = true;
                        if ($scope.freeModels.id.length > 0) {
                            // is the model we are check in the for free array
                            isFree = ( $.inArray(model.id, $scope.freeModels.id) !== -1 && $scope.countSelectedModel($scope.freeModels.id.join('|'), 'id').free <= $scope.freeModels.count );
                        } else {
                            isFree = false;
                        }

                        if (!isFree) {
                            model.cost = model.realCost;
                            delete model.freeModel;
                            delete model.realCost;
                            $scope.calculateTierLevel();
                        }
                    }
                    recursive(model.group);
                });
            };
            recursive($scope.selectedModels);
        };

        // get the real model cost
        $scope.getModelCost = function(model, checkFree, getMax, groupIdx) {
            if ( typeof(checkFree) === 'undefined' ) { checkFree = false; }
            if ( typeof(getMax) === 'undefined' ) { getMax = false; }
            if ( typeof(groupIdx) === 'undefined' ) { groupIdx = false; }
            var rCost;

            if ( ( getMax && model.hasOwnProperty('costMax') ) || ( model.hasOwnProperty('useMax') && model.useMax ) ) {
                rCost = parseInt(model.costMax);
            } else if ( model.hasOwnProperty('attached') ) {
                rCost = parseInt(model.cost * model.attached);
            } else {
                rCost = parseInt(model.cost);
            }

            // We have an group model and show if there any bonus
            if ( groupIdx !== false && $scope.selectedModels[groupIdx].hasOwnProperty('bonded_bonus') ) {
                rCost = rCost - $scope.selectedModels[groupIdx].bonded_bonus;
            }

            // only run this checks if we have an tier
            if ( $scope.tier ) {
                // Check for bonus points for Models
                var bonus = $scope.costAlterations[model.id];
                if (bonus) {
                    rCost -= bonus;
                }

                // Check for free models
                if ($scope.freeModels.id.length > 0 && checkFree) {
                    // is the model we are check in the for free array
                    var isFree = ( $.inArray(model.id, $scope.freeModels.id) !== -1 );

                    if ($scope.countSelectedModel($scope.freeModels.id.join('|'), 'id').free < $scope.freeModels.count && isFree) {
                        rCost = parseInt(0);
                    }
                }
            }

            return rCost;
        };

        // Get true if this model with Bonus points
        $scope.isBonusCost = function(model, checkFree, groupIdx) {
            if ( typeof(checkFree) === 'undefined' ) { checkFree = true; }
            var cost = model.cost;

            if ( model.hasOwnProperty('freeModel') && model.freeModel === 1 && model.cost === 0 ) {
                return true;
            } else if ( /^unit/i.test(model.type) ) {
                if ( model.useMax === 1 ) {
                    cost = model.costMax;
                }
            } else if (/^wa$/i.test(model.type)) {
                cost = model.cost * model.attached;
            }

            return cost !== $scope.getModelCost(model, checkFree, false, groupIdx);
        };

        // get the real model FA
        $scope.getModelFa = function(model) {
            // only run this checks if we have an tier and not an character
            var fa = model.fa;
            if ( $scope.tier && model.fa && model.fa !== 'C') {
                // Check for bonus FA for Models
                var bonus = $scope.faAlterations[model.id];
                if (bonus) {
                    fa = parseInt(model.fa) + parseInt(bonus);
                }
            }

            // number over 100 this model is unlimited
            if ( fa > 100 ) {
                fa = 'U';
            }

            // no val means this model is an Character
            if ( !fa ) {
                fa = 'C';
            }

            return fa;
        };

        // No sort for ng-repeat
        $scope.notSorted = function(obj){
		    if (!obj) {
		        return [];
		    }
		    return Object.keys(obj);
		};

        $scope.createModStr = function(model) {

        };

        // add currently selects in the URL
        $scope.updateSearch = function() {
            //get the selectedModels as string
            var search = {},
                sel = [];
            var recursive = function(models) {
                $.each(models, function(k, model) {
                    var modStr = model.id;

                    //an unit have an max size
                    if ( model.hasOwnProperty('useMax') && model.useMax === true ) {
                        modStr += ':m';
                    }

                    //a bonded model
                    if ( model.hasOwnProperty('bonded') && model.bonded === 1 ) {
                        modStr += ':b';
                    }

                    //a free model
                    if ( model.hasOwnProperty('freeModel') && model.freeModel === 1 ) {
                        modStr += ':f';
                    }

                    //a weapon attachment with the attached size
                    if ( model.hasOwnProperty('attached') ) {
                        modStr += ':a#' + model.attached;
                    }
                    sel.push(modStr);
                    recursive(model.group);
                });
            };
             recursive($scope.selectedModels);

            search.sel = btoa(sel);
            search.caster = $scope.gameCaster;
            search.points = $scope.gamePoints;
            search.tier = $scope.gameTier === 0 ? '' : $scope.gameTier;
            search.objective =  $scope.gameObjective;

            $location.search( search );
        };

        // Get the selects from the URL
        // Test URL http://127.0.0.1:4001/troop-creator/#/build/trollblood?sel=VHowMixUQjA5OmJvbmRlZCxUQjExOmJvbmRlZCxUUzAz&caster=1&points=50&tier=&objective=
        $scope.restoreSearch = function() {
            var search = $location.search();
            // restore gamePoints
            if (search.points) {
                $scope.gamePoints = search.points;
            }
            //restore gameCaster
            if (search.caster) {
                $scope.gameCaster = search.caster;
            }
            // restore gameTier
            if (search.tier) {
                $scope.gameTier = search.tier;
                $scope.tier = $scope.tiers[$scope.gameTier];
            }
            // restore gameTier
            if (search.objective) {
                $scope.gameObjective = search.objective;
            }
            //restore selectedModels
            if (search.sel) {
                var decode = atob(search.sel),
                    sel = decode.split(',');
                $.each(sel, function(key, val) {
                    $scope.addModelByString(val);
                });
            }
            $scope.calculatePoints();
        };

        // adds an model by only give an string
        $scope.addModelByString = function(string) {
            //split by id an option
            var args = string.split(':');

            //search in data for id = args[0]
            var add = {};
            $.each($scope.data, function(k, grp) {
                $.each(grp.entries, function(k, entrie) {
                    if ( entrie.id === args[0] ) {
                        add = angular.copy(entrie);
                        return false;
                    }
                });
                if ( add.length > 0 ) {
                    return false;
                }
            });

            if (!$.isEmptyObject(add) ) {
                add.group = [];
                for (var i = 0; i <= args.length ; i++) {
                    if (args[i] === 'bonded' || args[i] === 'b') {
                        add.bonded = 1;
                    }

                    if (args[i] === 'useMax' || args[i] === 'm') {
                        add.useMax = true;
                    }

                    if (args[i] === 'freeModel' || args[i] === 'f') {
                        add.freeModel = 1;
                        add.realCost = add.cost;
                        add.cost = 0;
                    }

                    if ( /^attached/i.test(args[i]) || /^a#/i.test(args[i]) ) {
                        var split = args[i].split('#');
                        add.attached = parseInt(split[1]);
                    }
                }
                // Add bonded models in .group from the last model
                if ( add.bonded === 1 ) {
                    var lastIdx = $scope.selectedModels.length - 1;

                    // an UAMarchall change the type of his group to unitMarshall
                    if ( /uamarshall/i.test(add.type) ) {
                        $scope.selectedModels[lastIdx].type = 'unitMarshall';
                    }

                    $scope.selectedModels[lastIdx].group.push(add);
                } else {
                    $scope.selectedModels.push(add);
                }
            }
        };

        // get model by ID
        $scope.getModelById = function(id) {
            var found = false;
            $.each($scope.data, function(key, grp) {
                $.each(grp.entries, function(key, model) {
                    if ( model.id === id ) {
                        found = model;
                        return true;
                    }
                });
                if ( found ) {
                    return true;
                }
            });
            return found;
        };

        // callback if the tier changed
        $scope.changeTier = function() {
            $scope.tier = $scope.tiers[$scope.gameTier];
            $scope.clearList();
            if ( $scope.tier !== undefined && $scope.tier.hasOwnProperty('casterId') ) {
                $scope.addModelByString($scope.tier.casterId);
                $('.army-models:eq(1) .accordion-container').slideDown().parent().siblings().find('.accordion-container').slideUp();
            }
        };

        // clear the complete list
        $scope.clearList = function() {
            $scope.selectedModels = [];
            $scope.calculatePoints();
        };

        // Try save the link in bookmark
        $scope.saveListAsFav = function() {
            var bookmarkURL = window.location.href;
            var bookmarkTitle = document.title;

            if ('addToHomescreen' in window && window.addToHomescreen.isCompatible) {
                // Mobile browsers
                addToHomescreen({ autostart: false, startDelay: 0 }).show(true);
            } else if (window.sidebar && window.sidebar.addPanel) {
                // Firefox version < 23
                window.sidebar.addPanel(bookmarkTitle, bookmarkURL, '');
            } else if ((window.sidebar && /Firefox/i.test(navigator.userAgent)) || (window.opera && window.print)) {
                // Firefox version >= 23 and Opera Hotlist
                $(this).attr({
                    href: bookmarkURL,
                    title: bookmarkTitle,
                    rel: 'sidebar'
                }).off(e);
                return true;
            } else if (window.external && ('AddFavorite' in window.external)) {
                // IE Favorite
                window.external.AddFavorite(bookmarkURL, bookmarkTitle);
            } else {
                // Other browsers (mainly WebKit - Chrome/Safari)
                alert('Press ' + (/Mac/i.test(navigator.userAgent) ? 'Cmd' : 'Ctrl') + '+D to bookmark this page.');
            }

            return false;
        };

        $scope.devAddId = function() {
            $.each($scope.data, function(group, items) {
                $.each(items.entries, function(key, item) {
                    item.name = item.id + " - " + item.name;
                });
            });
        };
    }]
);
